/**
 * Integration tests for the SMS trial-verification gate (Task #637 surface).
 *
 * Runs the REAL auth router against the REAL Postgres pool, injecting requests
 * IN-PROCESS (the vitest worker pool never fires `app.listen`'s callback, so a
 * real port + fetch would hang — see test-utils/injectRequest). The full
 * middleware chain runs (cookie-parser, body parsing, the rate-limit limiters,
 * the route handlers). Token minting/redemption and trial bookkeeping run
 * against the real DB; only the Twilio Verify/Lookup network calls and the
 * Turnstile siteverify round-trip are mocked.
 *
 * Asserted branches (the gate is easy to regress):
 *   1. /phone/config reports required=false when Twilio is unconfigured and
 *      required=true when it is.
 *   2. Unconfigured Twilio keeps the legacy path: signup still grants the
 *      14-day trial window with no token.
 *   3. Configured Twilio + a valid token grants the trial AND records the
 *      number as having consumed its one free trial.
 *   4. A number that has ALREADY trialed lands on the free floor — tenant
 *      created with NULL trial window, trialGranted=false.
 *   5. A missing / invalid / expired token => 400 phone_verification_required
 *      and the signup transaction is rolled back (no tenant, user still
 *      tenantless).
 *   6. /phone/send-code rejects a VOIP/landline-style number and returns 503
 *      when Twilio is unconfigured.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomBytes } from "node:crypto";

const { twilio } = vi.hoisted(() => ({
  twilio: {
    configured: false,
    lookup: vi.fn(),
    send: vi.fn(),
    check: vi.fn(),
  },
}));

vi.mock("../lib/twilioVerify", async (importActual) => {
  const actual = await importActual<typeof import("../lib/twilioVerify")>();
  return {
    ...actual, // keep the real isVoipLineType pure helper
    twilioConfigured: () => twilio.configured,
    lookupLineType: twilio.lookup,
    sendVerificationCode: twilio.send,
    checkVerificationCode: twilio.check,
  };
});

vi.mock("../lib/turnstile", async (importActual) => {
  const actual = await importActual<typeof import("../lib/turnstile")>();
  return {
    ...actual,
    verifyTurnstile: vi.fn(async () => ({ ok: true, configured: false })),
  };
});

const { pool } = await import("@workspace/db");
const { inject } = await import("../test-utils/injectRequest");
const { mintPhoneVerifiedToken, hashPhone } = await import("../lib/phoneVerification");
const { invalidateTenantHostCache } = await import("../lib/tenantHosts");
const authRouter = (await import("./auth")).default;
const { SESSION_COOKIE } = await import("./auth");

const RAND = randomBytes(4).toString("hex");

let app: Express;

// Track everything we create so afterAll can clean the shared PROD pool.
const createdUserIds: number[] = [];
const createdSids: string[] = [];
const createdTenantIds: number[] = [];
const createdPhoneHashes: string[] = [];

/**
 * Seed a logged-in user with NO tenant yet (the precondition for signup and
 * for the phone endpoints) plus the server-side session the routes read via
 * the lp_sid cookie. Returns the ids/sid for use + cleanup.
 */
async function seedTenantlessUser(tag: string): Promise<{ userId: number; sid: string; email: string }> {
  const email = `phonetrial-${tag}-${RAND}@example.test`;
  const userRes = await pool.query<{ id: number }>(
    `INSERT INTO app_users (email, name, role, status) VALUES ($1, 'Phone Trial', 'admin', 'active') RETURNING id`,
    [email],
  );
  const userId = userRes.rows[0].id;
  const sid = `phonetrial-sid-${tag}-${RAND}`;
  await pool.query(
    `INSERT INTO app_sessions (sid, sess, expire) VALUES ($1, $2, now() + interval '7 days')`,
    [sid, JSON.stringify({ userId, email })],
  );
  createdUserIds.push(userId);
  createdSids.push(sid);
  return { userId, sid, email };
}

beforeAll(() => {
  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api", authRouter);
});

beforeEach(() => {
  twilio.configured = false;
  twilio.lookup.mockReset();
  twilio.send.mockReset();
  twilio.check.mockReset();
});

afterAll(async () => {
  for (const tid of createdTenantIds) {
    await pool.query(`DELETE FROM tenant_members WHERE tenant_id = $1`, [tid]).catch(() => {});
    await pool.query(`DELETE FROM tenant_roles WHERE tenant_id = $1`, [tid]).catch(() => {});
  }
  for (const ph of createdPhoneHashes) {
    await pool.query(`DELETE FROM trial_phone_numbers WHERE phone_hash = $1`, [ph]).catch(() => {});
  }
  for (const uid of createdUserIds) {
    await pool.query(`UPDATE app_users SET tenant_id = NULL WHERE id = $1`, [uid]).catch(() => {});
    await pool.query(`DELETE FROM trial_phone_tokens WHERE user_id = $1`, [uid]).catch(() => {});
  }
  for (const tid of createdTenantIds) {
    await pool.query(`DELETE FROM tenants WHERE id = $1`, [tid]).catch(() => {});
  }
  for (const sid of createdSids) {
    await pool.query(`DELETE FROM app_sessions WHERE sid = $1`, [sid]).catch(() => {});
  }
  for (const uid of createdUserIds) {
    await pool.query(`DELETE FROM app_users WHERE id = $1`, [uid]).catch(() => {});
  }
  invalidateTenantHostCache();
});

describe("GET /api/auth/phone/config", () => {
  it("reports required=false when Twilio is unconfigured", async () => {
    twilio.configured = false;
    const res = await inject(app, { method: "GET", url: "/api/auth/phone/config" });
    expect(res.status).toBe(200);
    expect((res.json as { required?: boolean }).required).toBe(false);
  });

  it("reports required=true when Twilio is configured", async () => {
    twilio.configured = true;
    const res = await inject(app, { method: "GET", url: "/api/auth/phone/config" });
    expect(res.status).toBe(200);
    expect((res.json as { required?: boolean }).required).toBe(true);
  });
});

describe("POST /api/auth/signup — trial phone gate", () => {
  it("grants the 14-day trial with no token when Twilio is unconfigured", async () => {
    twilio.configured = false;
    const { sid } = await seedTenantlessUser("unconfigured");
    const slug = `ptunconf${RAND}`;

    const res = await inject(app, {
      method: "POST",
      url: "/api/auth/signup",
      headers: { cookie: `${SESSION_COOKIE}=${sid}` },
      body: { name: `Unconfigured ${RAND}`, slug },
    });

    expect(res.status).toBe(200);
    const body = res.json as { ok?: boolean; tenant?: { id: number }; trialGranted?: boolean };
    expect(body.ok).toBe(true);
    expect(body.trialGranted).toBe(true);
    const tenantId = body.tenant?.id ?? null;
    expect(tenantId).not.toBeNull();
    createdTenantIds.push(tenantId as number);

    const row = await pool.query<{ trial_started_at: Date | null; trial_expires_at: Date | null }>(
      `SELECT trial_started_at, trial_expires_at FROM tenants WHERE id = $1`,
      [tenantId],
    );
    expect(row.rows[0].trial_started_at).not.toBeNull();
    expect(row.rows[0].trial_expires_at).not.toBeNull();
  });

  it("grants the trial and records the number when a valid token is presented", async () => {
    twilio.configured = true;
    const { userId, sid } = await seedTenantlessUser("validtoken");
    const phone = "+15125550133";
    const phoneHash = hashPhone(phone);
    createdPhoneHashes.push(phoneHash);
    const token = await mintPhoneVerifiedToken({ userId, phoneE164: phone });
    const slug = `ptvalid${RAND}`;

    const res = await inject(app, {
      method: "POST",
      url: "/api/auth/signup",
      headers: { cookie: `${SESSION_COOKIE}=${sid}` },
      body: { name: `Valid ${RAND}`, slug, phoneVerifiedToken: token },
    });

    expect(res.status).toBe(200);
    const body = res.json as {
      ok?: boolean;
      tenant?: { id: number };
      trialGranted?: boolean;
      phoneAlreadyTrialed?: boolean;
    };
    expect(body.ok).toBe(true);
    expect(body.trialGranted).toBe(true);
    expect(body.phoneAlreadyTrialed).toBe(false);
    const tenantId = body.tenant?.id ?? null;
    expect(tenantId).not.toBeNull();
    createdTenantIds.push(tenantId as number);

    // Trial window populated AND the number recorded as having consumed its one trial.
    const row = await pool.query<{ trial_started_at: Date | null; trial_expires_at: Date | null }>(
      `SELECT trial_started_at, trial_expires_at FROM tenants WHERE id = $1`,
      [tenantId],
    );
    expect(row.rows[0].trial_started_at).not.toBeNull();
    expect(row.rows[0].trial_expires_at).not.toBeNull();

    const trialRow = await pool.query(
      `SELECT tenant_id FROM trial_phone_numbers WHERE phone_hash = $1`,
      [phoneHash],
    );
    expect(trialRow.rows).toHaveLength(1);
    expect((trialRow.rows[0] as { tenant_id: number }).tenant_id).toBe(tenantId);
  });

  it("creates a free-floor tenant (no trial window) when the number has already trialed", async () => {
    twilio.configured = true;
    const { userId, sid } = await seedTenantlessUser("repeat");
    const phone = "+15125550199";
    const phoneHash = hashPhone(phone);
    createdPhoneHashes.push(phoneHash);

    // Pre-mark the number as having consumed its one free trial.
    await pool.query(
      `INSERT INTO trial_phone_numbers (phone_hash, tenant_id) VALUES ($1, NULL) ON CONFLICT (phone_hash) DO NOTHING`,
      [phoneHash],
    );
    const token = await mintPhoneVerifiedToken({ userId, phoneE164: phone });
    const slug = `ptrepeat${RAND}`;

    const res = await inject(app, {
      method: "POST",
      url: "/api/auth/signup",
      headers: { cookie: `${SESSION_COOKIE}=${sid}` },
      body: { name: `Repeat ${RAND}`, slug, phoneVerifiedToken: token },
    });

    expect(res.status).toBe(200);
    const body = res.json as {
      ok?: boolean;
      tenant?: { id: number };
      trialGranted?: boolean;
      phoneAlreadyTrialed?: boolean;
    };
    expect(body.ok).toBe(true);
    expect(body.trialGranted).toBe(false);
    expect(body.phoneAlreadyTrialed).toBe(true);
    const tenantId = body.tenant?.id ?? null;
    expect(tenantId).not.toBeNull();
    createdTenantIds.push(tenantId as number);

    // Free floor: NO trial window.
    const row = await pool.query<{ trial_started_at: Date | null; trial_expires_at: Date | null }>(
      `SELECT trial_started_at, trial_expires_at FROM tenants WHERE id = $1`,
      [tenantId],
    );
    expect(row.rows[0].trial_started_at).toBeNull();
    expect(row.rows[0].trial_expires_at).toBeNull();
  });

  it("rejects signup with 400 and rolls back when no token is presented", async () => {
    twilio.configured = true;
    const { userId, sid } = await seedTenantlessUser("notoken");
    const slug = `ptnotoken${RAND}`;

    const res = await inject(app, {
      method: "POST",
      url: "/api/auth/signup",
      headers: { cookie: `${SESSION_COOKIE}=${sid}` },
      body: { name: `No Token ${RAND}`, slug },
    });

    expect(res.status).toBe(400);
    expect((res.json as { code?: string }).code).toBe("phone_verification_required");

    // Rollback: no tenant with that slug, user still tenantless.
    const tenantRow = await pool.query(`SELECT id FROM tenants WHERE slug = $1`, [slug]);
    expect(tenantRow.rows).toHaveLength(0);
    const userRow = await pool.query<{ tenant_id: number | null }>(
      `SELECT tenant_id FROM app_users WHERE id = $1`,
      [userId],
    );
    expect(userRow.rows[0].tenant_id).toBeNull();
  });

  it("rejects signup with 400 and rolls back when the token is expired", async () => {
    twilio.configured = true;
    const { userId, sid } = await seedTenantlessUser("expired");
    const phone = "+15125550111";
    // Mint an already-expired token (negative TTL).
    const token = await mintPhoneVerifiedToken({ userId, phoneE164: phone, ttlMs: -1000 });
    const slug = `ptexpired${RAND}`;

    const res = await inject(app, {
      method: "POST",
      url: "/api/auth/signup",
      headers: { cookie: `${SESSION_COOKIE}=${sid}` },
      body: { name: `Expired ${RAND}`, slug, phoneVerifiedToken: token },
    });

    expect(res.status).toBe(400);
    expect((res.json as { code?: string }).code).toBe("phone_verification_required");

    const tenantRow = await pool.query(`SELECT id FROM tenants WHERE slug = $1`, [slug]);
    expect(tenantRow.rows).toHaveLength(0);
    const userRow = await pool.query<{ tenant_id: number | null }>(
      `SELECT tenant_id FROM app_users WHERE id = $1`,
      [userId],
    );
    expect(userRow.rows[0].tenant_id).toBeNull();
  });
});

describe("POST /api/auth/phone/send-code", () => {
  it("returns 503 when Twilio is unconfigured", async () => {
    twilio.configured = false;
    const { sid } = await seedTenantlessUser("sendcode503");
    const res = await inject(app, {
      method: "POST",
      url: "/api/auth/phone/send-code",
      headers: { cookie: `${SESSION_COOKIE}=${sid}` },
      body: { phone: "+15125550123" },
    });
    expect(res.status).toBe(503);
    expect((res.json as { code?: string }).code).toBe("phone_not_configured");
    expect(twilio.lookup).not.toHaveBeenCalled();
  });

  it("rejects a VOIP/virtual number with 400 before sending an SMS", async () => {
    twilio.configured = true;
    twilio.lookup.mockResolvedValue({ valid: true, phoneNumber: "+15125550123", lineType: "nonFixedVoip" });
    const { sid } = await seedTenantlessUser("voip");

    const res = await inject(app, {
      method: "POST",
      url: "/api/auth/phone/send-code",
      headers: { cookie: `${SESSION_COOKIE}=${sid}` },
      body: { phone: "+15125550123" },
    });

    expect(res.status).toBe(400);
    expect((res.json as { code?: string }).code).toBe("voip_rejected");
    expect(twilio.send).not.toHaveBeenCalled();
  });

  it("texts a code and echoes the canonical E.164 for a real mobile", async () => {
    twilio.configured = true;
    twilio.lookup.mockResolvedValue({ valid: true, phoneNumber: "+15125550123", lineType: "mobile" });
    twilio.send.mockResolvedValue({ ok: true });
    const { sid } = await seedTenantlessUser("mobile");

    const res = await inject(app, {
      method: "POST",
      url: "/api/auth/phone/send-code",
      headers: { cookie: `${SESSION_COOKIE}=${sid}` },
      body: { phone: "512-555-0123" },
    });

    expect(res.status).toBe(200);
    const body = res.json as { ok?: boolean; phone?: string };
    expect(body.ok).toBe(true);
    expect(body.phone).toBe("+15125550123");
    expect(twilio.send).toHaveBeenCalledWith("+15125550123");
  });
});

describe("POST /api/auth/phone/verify-code", () => {
  it("mints a token and reports alreadyTrialed=false for a fresh number", async () => {
    twilio.configured = true;
    twilio.check.mockResolvedValue({ approved: true });
    const { userId, sid } = await seedTenantlessUser("verifyok");
    const phone = "+15125550150";
    createdPhoneHashes.push(hashPhone(phone));

    const res = await inject(app, {
      method: "POST",
      url: "/api/auth/phone/verify-code",
      headers: { cookie: `${SESSION_COOKIE}=${sid}` },
      body: { phone, code: "123456" },
    });

    expect(res.status).toBe(200);
    const body = res.json as { ok?: boolean; phoneVerifiedToken?: string; alreadyTrialed?: boolean };
    expect(body.ok).toBe(true);
    expect(typeof body.phoneVerifiedToken).toBe("string");
    expect(body.alreadyTrialed).toBe(false);

    // A redeemable token row now exists for the user.
    const tok = await pool.query(
      `SELECT 1 FROM trial_phone_tokens WHERE user_id = $1 AND used_at IS NULL AND expires_at > now()`,
      [userId],
    );
    expect(tok.rows).toHaveLength(1);
  });

  it("rejects an incorrect code with 400 and does not mint a token", async () => {
    twilio.configured = true;
    twilio.check.mockResolvedValue({ approved: false });
    const { userId, sid } = await seedTenantlessUser("verifybad");

    const res = await inject(app, {
      method: "POST",
      url: "/api/auth/phone/verify-code",
      headers: { cookie: `${SESSION_COOKIE}=${sid}` },
      body: { phone: "+15125550160", code: "000000" },
    });

    expect(res.status).toBe(400);
    expect((res.json as { code?: string }).code).toBe("code_invalid");
    const tok = await pool.query(`SELECT 1 FROM trial_phone_tokens WHERE user_id = $1`, [userId]);
    expect(tok.rows).toHaveLength(0);
  });
});
