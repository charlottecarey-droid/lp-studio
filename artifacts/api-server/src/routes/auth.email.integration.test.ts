/**
 * Integration tests for the public email/password auth surface (Task #624).
 *
 * Runs the REAL auth router against the REAL Postgres pool, injecting requests
 * IN-PROCESS (the vitest worker pool never fires `app.listen`'s callback, so a
 * real port + fetch would hang — see test-utils/injectRequest). The full
 * middleware chain runs (cookie-parser, body parsing, the express-rate-limit
 * limiters, the route handlers).
 *
 * Asserted security contracts:
 *   1. No account enumeration on register — a brand-new address and an
 *      already-registered address return the byte-identical generic success,
 *      and the duplicate never creates a second app_users row.
 *   2. Bot protection — when Turnstile is configured and the token fails, the
 *      register route rejects with 400 before any account is created.
 *   3. Rate limiting — the password-auth limiter returns 429 once its window
 *      budget is exceeded (the 6th request, max=5).
 *
 * Side effects are mocked so nothing leaves the process: the email senders are
 * stubbed (the pool here is PROD — we must never send to fake addresses) and
 * token minting is neutralized so no auth_email_tokens rows are written.
 * Turnstile verification is mocked so we can flip pass/fail per test without a
 * live Cloudflare round-trip.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { dbAvailable } from "../test-utils/dbAvailable";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomBytes } from "node:crypto";

const { mockTurnstile } = vi.hoisted(() => ({ mockTurnstile: { ok: true } }));

vi.mock("../lib/turnstile", async (importActual) => {
  const actual = await importActual<typeof import("../lib/turnstile")>();
  return {
    ...actual,
    verifyTurnstile: vi.fn(async () => ({ ok: mockTurnstile.ok, configured: false })),
  };
});

vi.mock("../lib/notifications", async (importActual) => {
  const actual = await importActual<typeof import("../lib/notifications")>();
  return {
    ...actual,
    sendMagicLinkEmail: vi.fn(async () => {}),
    sendPasswordResetEmail: vi.fn(async () => {}),
    sendEmailVerificationEmail: vi.fn(async () => {}),
  };
});

vi.mock("../lib/authEmailTokens", async (importActual) => {
  const actual = await importActual<typeof import("../lib/authEmailTokens")>();
  return {
    ...actual,
    mintEmailToken: vi.fn(async () => "test-token"),
    invalidateUserTokens: vi.fn(async () => {}),
  };
});

const { pool } = await import("@workspace/db");
const { inject } = await import("../test-utils/injectRequest");
const authRouter = (await import("./auth")).default;

const RAND = randomBytes(4).toString("hex");
const NEW_EMAIL = `it-authmail-new-${RAND}@example.test`;
const DUP_EMAIL = `it-authmail-dup-${RAND}@example.test`;
const BLOCKED_EMAIL = `it-authmail-blocked-${RAND}@example.test`;
const PASSWORD = "Sup3rSecret!";

let app: Express;

beforeAll(() => {
  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api", authRouter);
});

afterAll(async () => {
  await pool
    .query(`DELETE FROM app_users WHERE email = ANY($1)`, [[NEW_EMAIL, DUP_EMAIL, BLOCKED_EMAIL]])
    .catch(() => {});
});

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("POST /api/auth/email/register — no account enumeration", () => {
  it("returns the same generic success for a new and an existing email, and never duplicates the account", async () => {
    mockTurnstile.ok = true;

    const first = await inject(app, {
      method: "POST",
      url: "/api/auth/email/register",
      body: { email: DUP_EMAIL, password: PASSWORD, name: "Dup One", turnstileToken: "x" },
    });
    expect(first.status).toBe(200);
    expect((first.json as { ok?: boolean }).ok).toBe(true);

    // Same address again, different password — the ON CONFLICT DO NOTHING path.
    const second = await inject(app, {
      method: "POST",
      url: "/api/auth/email/register",
      body: { email: DUP_EMAIL, password: "An0therPass!", name: "Dup Two", turnstileToken: "x" },
    });
    expect(second.status).toBe(200);

    // The response must be byte-identical — no signal that the address existed.
    expect(second.json).toEqual(first.json);

    // And only one account exists (the second register did not overwrite/create).
    const rows = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM app_users WHERE email = $1`,
      [DUP_EMAIL],
    );
    expect(rows.rows[0]!.count).toBe("1");
  });
});

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("POST /api/auth/email/register — bot protection", () => {
  it("rejects with 400 and creates no account when the Turnstile check fails", async () => {
    mockTurnstile.ok = false;
    try {
      const res = await inject(app, {
        method: "POST",
        url: "/api/auth/email/register",
        body: { email: BLOCKED_EMAIL, password: PASSWORD, name: "Blocked", turnstileToken: "bad" },
      });
      expect(res.status).toBe(400);
      expect((res.json as { error?: string }).error).toMatch(/bot check/i);

      const rows = await pool.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM app_users WHERE email = $1`,
        [BLOCKED_EMAIL],
      );
      expect(rows.rows[0]!.count).toBe("0");
    } finally {
      mockTurnstile.ok = true;
    }
  });
});

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("rate limiting", () => {
  it("returns 429 once the password-auth limiter budget is exceeded (6th request)", async () => {
    // The password-auth limiter (max 5 / 15min) is untouched until here, so the
    // first 5 bad-credential logins are rejected on their own merits (401) and
    // the 6th is blocked by the limiter (429) before the handler runs.
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await inject(app, {
        method: "POST",
        url: "/api/auth/email/login",
        body: { email: `it-authmail-rl-${RAND}@example.test`, password: "whatever-wrong" },
      });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 5).every((s) => s === 401)).toBe(true);
    expect(statuses[5]).toBe(429);
  });
});
