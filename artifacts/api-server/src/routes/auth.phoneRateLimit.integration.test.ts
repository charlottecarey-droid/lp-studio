/**
 * Integration tests for the SMS endpoints' rate limiters (Task #668 surface).
 *
 * Each SMS send costs a real (billable) message and the verify endpoint is a
 * code-guessing surface, so both routes are tightly rate-limited:
 *   - phoneSendLimiter:   5  requests / 15min / IP  (POST /phone/send-code)
 *   - phoneVerifyLimiter: 10 requests / 15min / IP  (POST /phone/verify-code)
 *
 * These limiters had no automated coverage, so a future refactor could silently
 * loosen or drop them. The tests below exceed each limiter's window budget and
 * assert that a 429 is returned exactly once the cap is hit.
 *
 * Runs the REAL auth router with the full middleware chain (including the
 * express-rate-limit limiters) and injects requests IN-PROCESS (the vitest
 * worker pool never fires `app.listen`'s callback, so a real port + fetch would
 * hang — see test-utils/injectRequest). The limiters are module-level
 * singletons keyed by IP; vitest isolates each test file's module registry, so
 * importing the router here yields a fresh, untouched budget for both limiters.
 *
 * Twilio is fully mocked so NO SMS is ever sent: send-code runs with Twilio
 * unconfigured (the 503 short-circuit fires before any lookup/send), and
 * verify-code uses a mocked check that never triggers a real network call.
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
const authRouter = (await import("./auth")).default;
const { SESSION_COOKIE } = await import("./auth");

const RAND = randomBytes(4).toString("hex");

let app: Express;

const createdUserIds: number[] = [];
const createdSids: string[] = [];

/**
 * Seed a logged-in user with NO tenant yet (the precondition the phone
 * endpoints enforce via requireTenantlessSession) plus the server-side session
 * the routes read via the lp_sid cookie. Returns the sid for use + cleanup.
 */
async function seedTenantlessUser(tag: string): Promise<{ userId: number; sid: string }> {
  const email = `phonerl-${tag}-${RAND}@example.test`;
  const userRes = await pool.query<{ id: number }>(
    `INSERT INTO app_users (email, name, role, status) VALUES ($1, 'Phone RL', 'admin', 'active') RETURNING id`,
    [email],
  );
  const userId = userRes.rows[0].id;
  const sid = `phonerl-sid-${tag}-${RAND}`;
  await pool.query(
    `INSERT INTO app_sessions (sid, sess, expire) VALUES ($1, $2, now() + interval '7 days')`,
    [sid, JSON.stringify({ userId, email })],
  );
  createdUserIds.push(userId);
  createdSids.push(sid);
  return { userId, sid };
}

beforeAll(() => {
  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api", authRouter);
});

beforeEach(() => {
  twilio.lookup.mockReset();
  twilio.send.mockReset();
  twilio.check.mockReset();
});

afterAll(async () => {
  for (const sid of createdSids) {
    await pool.query(`DELETE FROM app_sessions WHERE sid = $1`, [sid]).catch(() => {});
  }
  for (const uid of createdUserIds) {
    await pool.query(`DELETE FROM app_users WHERE id = $1`, [uid]).catch(() => {});
  }
});

describe("POST /api/auth/phone/send-code — rate limiting", () => {
  it("returns 429 once the send-code limiter budget is exceeded (6th request)", async () => {
    // phoneSendLimiter: max 5 / 15min. Twilio is left unconfigured so each
    // request that clears the limiter short-circuits to 503 BEFORE any lookup
    // or SMS send — proving the cap is enforced without ever texting anyone.
    twilio.configured = false;
    const { sid } = await seedTenantlessUser("send");

    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await inject(app, {
        method: "POST",
        url: "/api/auth/phone/send-code",
        headers: { cookie: `${SESSION_COOKIE}=${sid}` },
        body: { phone: "+15125550123" },
      });
      statuses.push(res.status);
    }

    // First 5 clear the limiter and hit the handler (503, Twilio unconfigured);
    // the 6th is blocked by the limiter (429) before the handler runs.
    expect(statuses.slice(0, 5).every((s) => s === 503)).toBe(true);
    expect(statuses[5]).toBe(429);
    // No SMS path was ever exercised.
    expect(twilio.lookup).not.toHaveBeenCalled();
    expect(twilio.send).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/phone/verify-code — rate limiting", () => {
  it("returns 429 once the verify-code limiter budget is exceeded (11th request)", async () => {
    // phoneVerifyLimiter: max 10 / 15min. Twilio is configured but the mocked
    // check always rejects, so each request that clears the limiter is a 400
    // code_invalid; the limiter then blocks the 11th with a 429.
    twilio.configured = true;
    twilio.check.mockResolvedValue({ approved: false });
    const { sid } = await seedTenantlessUser("verify");

    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      const res = await inject(app, {
        method: "POST",
        url: "/api/auth/phone/verify-code",
        headers: { cookie: `${SESSION_COOKIE}=${sid}` },
        body: { phone: "+15125550123", code: "000000" },
      });
      statuses.push(res.status);
    }

    // First 10 clear the limiter and hit the handler (400, bad code); the 11th
    // is blocked by the limiter (429) before the handler runs.
    expect(statuses.slice(0, 10).every((s) => s === 400)).toBe(true);
    expect(statuses[10]).toBe(429);
    // verify-code never sends an SMS.
    expect(twilio.send).not.toHaveBeenCalled();
  });
});
