/**
 * Integration test for the superadmin trial-phone gate admin routes
 * (Task #643): GET /superadmin/trial-phones and
 * DELETE /superadmin/trial-phones/:phoneHash.
 *
 * Verifies:
 *   - a superadmin can list gated phones (hashed) joined to their tenant
 *   - a superadmin can release (delete) a specific record so the number can
 *     trial again, and the row is actually gone afterwards
 *   - releasing an unknown hash 404s
 *   - a malformed (non-64-hex) hash is rejected 400 before touching the DB
 *   - a non-superadmin session is rejected 403 on every route
 *
 * Exercised in-process via inject() against the REAL Postgres pool so the
 * requireSuperadmin middleware runs its real session + app_users lookups.
 * All seeded rows/sessions are cleaned up.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { dbAvailable } from "../test-utils/dbAvailable";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomUUID, createHash } from "node:crypto";
import { pool } from "@workspace/db";
import { SESSION_COOKIE, type AuthUser } from "../middleware/requireAuth";
import { inject } from "../test-utils/injectRequest";

const RUN = randomUUID().slice(0, 8);
const SUPER_EMAIL = `super-tp-${RUN}@example.com`;
const REP_EMAIL = `rep-tp-${RUN}@example.com`;

const SUPER_SID = `it-super-tp-${RUN}`;
const REP_SID = `it-rep-tp-${RUN}`;

// SHA-256 hex hashes of fake E.164 numbers — exactly what the gate stores.
const HASH_A = createHash("sha256").update(`+1555000${RUN}1`).digest("hex");
const HASH_B = createHash("sha256").update(`+1555000${RUN}2`).digest("hex");
const HASH_GHOST = createHash("sha256").update(`+1555000${RUN}9`).digest("hex");

// Lookup tests normalize a raw operator-typed number, so the fixtures must be
// DIGIT-only valid E.164 (RUN is hex and may contain a–f). Map each RUN char to
// a digit to get a stable, unique 8-digit suffix.
const DIGITS = RUN.replace(/[a-f]/g, (c) => String(c.charCodeAt(0) % 10));
const RAW_LOOKUP = `+1555${DIGITS}`; // +1 555 + 8 digits = valid E.164
const HASH_LOOKUP = createHash("sha256").update(RAW_LOOKUP).digest("hex");
const RAW_UNSEEDED = `+1556${DIGITS}`; // valid, but never inserted
const HASH_UNSEEDED = createHash("sha256").update(RAW_UNSEEDED).digest("hex");

let app: Express;
let superId = 0;
let repId = 0;
let tenantId = 0;

function sess(userId: number, email: string, role: "superadmin" | "rep"): string {
  const user: AuthUser = {
    userId,
    email,
    name: "IT",
    avatarUrl: null,
    tenantId: null,
    role,
    permissions: {},
    isAdmin: false,
    appUserRole: role,
  };
  return JSON.stringify(user);
}

async function insertUser(email: string, role: string): Promise<number> {
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO app_users (email, name, role, status, tenant_id)
     VALUES ($1, 'IT User', $2, 'active', NULL)
     RETURNING id`,
    [email, role],
  );
  return rows[0].id;
}

async function cleanup(): Promise<void> {
  await pool
    .query(`DELETE FROM trial_phone_lookup_log WHERE phone_hash = ANY($1)`, [
      [HASH_A, HASH_B, HASH_GHOST, HASH_LOOKUP, HASH_UNSEEDED],
    ])
    .catch(() => {});
  await pool
    .query(`DELETE FROM trial_phone_release_log WHERE phone_hash = ANY($1)`, [
      [HASH_A, HASH_B, HASH_GHOST, HASH_LOOKUP],
    ])
    .catch(() => {});
  await pool
    .query(`DELETE FROM trial_phone_numbers WHERE phone_hash = ANY($1)`, [
      [HASH_A, HASH_B, HASH_GHOST, HASH_LOOKUP],
    ])
    .catch(() => {});
  await pool.query(`DELETE FROM app_sessions WHERE sid = ANY($1)`, [[SUPER_SID, REP_SID]]).catch(() => {});
  await pool.query(`DELETE FROM app_users WHERE email = ANY($1)`, [[SUPER_EMAIL, REP_EMAIL]]).catch(() => {});
  if (tenantId) await pool.query(`DELETE FROM tenants WHERE id = $1`, [tenantId]).catch(() => {});
}

beforeAll(async () => {
  await cleanup();

  superId = await insertUser(SUPER_EMAIL, "superadmin");
  repId = await insertUser(REP_EMAIL, "rep");

  const { rows: trows } = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status) VALUES ($1, $2, 'active') RETURNING id`,
    [`Trial Phone IT ${RUN}`, `trial-phone-it-${RUN}`],
  );
  tenantId = trows[0].id;

  await pool.query(
    `INSERT INTO trial_phone_numbers (phone_hash, tenant_id) VALUES ($1, $2), ($3, $2), ($4, $2)`,
    [HASH_A, tenantId, HASH_B, HASH_LOOKUP],
  );

  await pool.query(
    `INSERT INTO app_sessions (sid, sess, expire) VALUES ($1, $2, now() + interval '1 hour')`,
    [SUPER_SID, sess(superId, SUPER_EMAIL, "superadmin")],
  );
  await pool.query(
    `INSERT INTO app_sessions (sid, sess, expire) VALUES ($1, $2, now() + interval '1 hour')`,
    [REP_SID, sess(repId, REP_EMAIL, "rep")],
  );

  const adminRouter = (await import("./admin")).default;
  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(adminRouter);
});

afterAll(async () => {
  await cleanup();
});

function asSuper(method: string, url: string, body?: unknown) {
  return inject(app, { method: method as any, url, headers: { cookie: `${SESSION_COOKIE}=${SUPER_SID}` }, body });
}
function asRep(method: string, url: string, body?: unknown) {
  return inject(app, { method: method as any, url, headers: { cookie: `${SESSION_COOKIE}=${REP_SID}` }, body });
}

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("trial-phones — list", () => {
  it("lets a superadmin list gated phones joined to their tenant", async () => {
    const res = await asSuper("GET", "/superadmin/trial-phones");
    expect(res.status).toBe(200);
    const rows = res.json as { phone_hash: string; tenant_id: number | null; tenant_slug: string | null }[];
    const a = rows.find((r) => r.phone_hash === HASH_A);
    expect(a).toBeTruthy();
    expect(a?.tenant_id).toBe(tenantId);
    expect(a?.tenant_slug).toBe(`trial-phone-it-${RUN}`);
    // Never leaks anything but the hash for the number itself.
    expect(rows.find((r) => r.phone_hash === HASH_B)).toBeTruthy();
  });

  it("rejects a non-superadmin with 403", async () => {
    const res = await asRep("GET", "/superadmin/trial-phones");
    expect(res.status).toBe(403);
  });
});

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("trial-phones — lookup", () => {
  it("reports a number that has trialed, joined to its tenant, and matches the seeded hash", async () => {
    const res = await asSuper("POST", "/superadmin/trial-phones/lookup", { phone: RAW_LOOKUP });
    expect(res.status).toBe(200);
    const body = res.json as {
      phoneHash: string;
      found: boolean;
      row: { phone_hash: string; tenant_id: number | null; tenant_slug: string | null } | null;
    };
    expect(body.phoneHash).toBe(HASH_LOOKUP);
    expect(body.found).toBe(true);
    expect(body.row?.phone_hash).toBe(HASH_LOOKUP);
    expect(body.row?.tenant_id).toBe(tenantId);
    expect(body.row?.tenant_slug).toBe(`trial-phone-it-${RUN}`);

    // The lookup writes a durable, append-only audit row recording who looked up
    // which hash, that it matched, and the matched-tenant snapshot — so a later
    // release is traceable back to the operator who looked it up.
    const { rows: log } = await pool.query<{
      found: boolean;
      matched_tenant_id: number | null;
      matched_tenant_slug: string | null;
      actor_user_id: number | null;
      actor_email: string | null;
    }>(
      `SELECT found, matched_tenant_id, matched_tenant_slug, actor_user_id, actor_email
         FROM trial_phone_lookup_log WHERE phone_hash = $1`,
      [HASH_LOOKUP],
    );
    expect(log.length).toBeGreaterThanOrEqual(1);
    expect(log[0].found).toBe(true);
    expect(log[0].matched_tenant_id).toBe(tenantId);
    expect(log[0].matched_tenant_slug).toBe(`trial-phone-it-${RUN}`);
    expect(log[0].actor_user_id).toBe(superId);
    expect(log[0].actor_email).toBe(SUPER_EMAIL);
  });

  it("normalizes formatting (spaces/dashes/parens) to the same hash", async () => {
    // Same digits as RAW_LOOKUP, just visually formatted — must still match.
    const formatted = `${RAW_LOOKUP.slice(0, 2)} (${RAW_LOOKUP.slice(2, 5)}) ${RAW_LOOKUP.slice(
      5,
    )}`.replace(/(\d{4})$/, "-$1");
    const res = await asSuper("POST", "/superadmin/trial-phones/lookup", { phone: ` ${formatted} ` });
    expect(res.status).toBe(200);
    const body = res.json as { phoneHash: string; found: boolean };
    expect(body.phoneHash).toBe(HASH_LOOKUP);
    expect(body.found).toBe(true);
  });

  it("reports a valid number that has NOT trialed as not found, auditing the lookup", async () => {
    const res = await asSuper("POST", "/superadmin/trial-phones/lookup", { phone: RAW_UNSEEDED });
    expect(res.status).toBe(200);
    const body = res.json as { phoneHash: string; found: boolean; row: unknown };
    expect(body.found).toBe(false);
    expect(body.row).toBeNull();
    expect(body.phoneHash).toMatch(/^[0-9a-f]{64}$/);

    // Even a "not found" lookup is audited (found=false, no tenant) so probing
    // is reviewable. Only the hash is stored — never the raw number.
    const { rows: log } = await pool.query<{
      found: boolean;
      matched_tenant_id: number | null;
      actor_email: string | null;
    }>(
      `SELECT found, matched_tenant_id, actor_email
         FROM trial_phone_lookup_log WHERE phone_hash = $1`,
      [HASH_UNSEEDED],
    );
    expect(log.length).toBeGreaterThanOrEqual(1);
    expect(log[0].found).toBe(false);
    expect(log[0].matched_tenant_id).toBeNull();
    expect(log[0].actor_email).toBe(SUPER_EMAIL);
  });

  it("rejects an unparseable number with 400 (no hash leaked)", async () => {
    const res = await asSuper("POST", "/superadmin/trial-phones/lookup", { phone: "not a phone" });
    expect(res.status).toBe(400);
    expect((res.json as { phoneHash?: string }).phoneHash).toBeUndefined();
  });

  it("rejects a non-superadmin with 403", async () => {
    const res = await asRep("POST", "/superadmin/trial-phones/lookup", { phone: RAW_LOOKUP });
    expect(res.status).toBe(403);
  });
});

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("trial-phones — release", () => {
  it("rejects a malformed hash with 400 (no DB hit)", async () => {
    const res = await asSuper("DELETE", "/superadmin/trial-phones/not-a-valid-hash");
    expect(res.status).toBe(400);
  });

  it("404s when releasing an unknown hash", async () => {
    const res = await asSuper("DELETE", `/superadmin/trial-phones/${HASH_GHOST}`);
    expect(res.status).toBe(404);
  });

  it("rejects a non-superadmin with 403", async () => {
    const res = await asRep("DELETE", `/superadmin/trial-phones/${HASH_A}`);
    expect(res.status).toBe(403);
    const { rows } = await pool.query(`SELECT 1 FROM trial_phone_numbers WHERE phone_hash = $1`, [HASH_A]);
    expect(rows.length).toBe(1);
  });

  it("releases a record so the number can trial again, writing a durable audit row", async () => {
    const res = await asSuper("DELETE", `/superadmin/trial-phones/${HASH_A}`);
    expect(res.status).toBe(200);
    const { rows } = await pool.query(`SELECT 1 FROM trial_phone_numbers WHERE phone_hash = $1`, [HASH_A]);
    expect(rows.length).toBe(0);

    // A durable, append-only audit row records who/when/which + the prior-tenant
    // snapshot (so it survives later tenant deletion).
    const { rows: log } = await pool.query<{
      phone_hash: string;
      prior_tenant_id: number | null;
      prior_tenant_slug: string | null;
      actor_user_id: number | null;
      actor_email: string | null;
    }>(
      `SELECT phone_hash, prior_tenant_id, prior_tenant_slug, actor_user_id, actor_email
         FROM trial_phone_release_log WHERE phone_hash = $1`,
      [HASH_A],
    );
    expect(log.length).toBe(1);
    expect(log[0].prior_tenant_id).toBe(tenantId);
    expect(log[0].prior_tenant_slug).toBe(`trial-phone-it-${RUN}`);
    expect(log[0].actor_user_id).toBe(superId);
    expect(log[0].actor_email).toBe(SUPER_EMAIL);
  });
});

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("trial-phones — release history", () => {
  it("lets a superadmin read the recent-release history including the just-released row", async () => {
    const res = await asSuper("GET", "/superadmin/trial-phones/release-log");
    expect(res.status).toBe(200);
    const body = res.json as {
      rows: { phone_hash: string; actor_email: string | null }[];
      hasMore: boolean;
    };
    expect(Array.isArray(body.rows)).toBe(true);
    expect(typeof body.hasMore).toBe("boolean");
    const entry = body.rows.find((r) => r.phone_hash === HASH_A);
    expect(entry).toBeTruthy();
    expect(entry?.actor_email).toBe(SUPER_EMAIL);
  });

  it("filters by phone-hash prefix", async () => {
    const prefix = HASH_A.slice(0, 12);
    const res = await asSuper(
      "GET",
      `/superadmin/trial-phones/release-log?q=${prefix}`,
    );
    expect(res.status).toBe(200);
    const body = res.json as { rows: { phone_hash: string }[] };
    expect(body.rows.length).toBeGreaterThan(0);
    expect(body.rows.every((r) => r.phone_hash.startsWith(prefix))).toBe(true);
  });

  it("filters by actor email and prior tenant slug substrings", async () => {
    const byEmail = await asSuper(
      "GET",
      `/superadmin/trial-phones/release-log?q=${encodeURIComponent(SUPER_EMAIL)}`,
    );
    expect(byEmail.status).toBe(200);
    const emailBody = byEmail.json as { rows: { phone_hash: string }[] };
    expect(emailBody.rows.some((r) => r.phone_hash === HASH_A)).toBe(true);

    const bySlug = await asSuper(
      "GET",
      `/superadmin/trial-phones/release-log?q=trial-phone-it-${RUN}`,
    );
    expect(bySlug.status).toBe(200);
    const slugBody = bySlug.json as { rows: { phone_hash: string }[] };
    expect(slugBody.rows.some((r) => r.phone_hash === HASH_A)).toBe(true);
  });

  it("returns an empty page (not all rows) for a non-matching search", async () => {
    const res = await asSuper(
      "GET",
      `/superadmin/trial-phones/release-log?q=zzz-no-such-release-${RUN}`,
    );
    expect(res.status).toBe(200);
    const body = res.json as { rows: unknown[]; hasMore: boolean };
    expect(body.rows.length).toBe(0);
    expect(body.hasMore).toBe(false);
  });

  it("honors limit + offset and reports hasMore for pagination", async () => {
    const page = await asSuper(
      "GET",
      "/superadmin/trial-phones/release-log?limit=1&offset=0",
    );
    expect(page.status).toBe(200);
    const body = page.json as { rows: unknown[]; hasMore: boolean };
    expect(body.rows.length).toBeLessThanOrEqual(1);
  });

  it("rejects a non-superadmin with 403", async () => {
    const res = await asRep("GET", "/superadmin/trial-phones/release-log");
    expect(res.status).toBe(403);
  });
});

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("trial-phones — lookup history", () => {
  it("lets a superadmin read the recent-lookup history including an audited lookup", async () => {
    const res = await asSuper("GET", "/superadmin/trial-phones/lookup-log");
    expect(res.status).toBe(200);
    const rows = res.json as {
      phone_hash: string;
      found: boolean;
      actor_email: string | null;
    }[];
    const entry = rows.find((r) => r.phone_hash === HASH_LOOKUP);
    expect(entry).toBeTruthy();
    expect(entry?.found).toBe(true);
    expect(entry?.actor_email).toBe(SUPER_EMAIL);
  });

  it("rejects a non-superadmin with 403", async () => {
    const res = await asRep("GET", "/superadmin/trial-phones/lookup-log");
    expect(res.status).toBe(403);
  });
});
