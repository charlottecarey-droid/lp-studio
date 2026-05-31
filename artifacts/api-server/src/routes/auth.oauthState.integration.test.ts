/**
 * Integration tests for OAuth login-CSRF hardening (Task #680).
 *
 * Both the Google and GitHub OAuth callbacks now verify the `state` param
 * against a server-stored, single-use nonce (oauth_login_states) BEFORE any
 * token exchange or session creation. Without this an attacker could forge or
 * replay a `state` and drive a victim's browser into an attacker-owned
 * authenticated session (login CSRF).
 *
 * These tests run the REAL auth router in-process (inject(), since the vitest
 * worker pool never fires app.listen — see test-utils/injectRequest) against the
 * REAL Postgres pool (so the nonce mint/redeem is exercised end to end).
 *
 * The callback half normally makes live Google/GitHub calls, which makes a full
 * success path non-hermetic. We exploit the handler's own ordering instead: the
 * state gate runs FIRST, and the provider-config check runs immediately AFTER
 * it. So with the provider env unset:
 *   - an INVALID state (missing/forged/replayed/wrong-provider) short-circuits
 *     to `/?error=invalid_state` and the row is never touched, and
 *   - a VALID state passes the gate (consuming the nonce) and then falls through
 *     to `/?error=oauth_not_configured` — never reaching the network.
 * That cleanly proves "rejected unless the state is valid" without mocking the
 * providers, and lets us assert the nonce was consumed (single-use).
 */
import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import crypto from "node:crypto";
import { pool } from "@workspace/db";
import { inject } from "../test-utils/injectRequest";
import { mintOAuthState } from "../lib/oauthState";

const authRouter = (await import("./auth")).default;

const ENV_KEYS = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REDIRECT_URI",
  "GITHUB_OAUTH_CLIENT_ID",
  "GITHUB_OAUTH_CLIENT_SECRET",
  "GITHUB_OAUTH_REDIRECT_URI",
] as const;

const ORIGINAL_ENV: Record<string, string | undefined> = {};

let app: Express;

// Unique marker so cleanup only removes rows this suite created.
const TEST_HOST = `oauth-state-it-${crypto.randomUUID()}.example.test`;
const seededStates: string[] = [];

async function seedValidState(
  provider: "google" | "github",
): Promise<string> {
  const state = await mintOAuthState(provider, {
    host: TEST_HOST,
    redirectUri: `https://${TEST_HOST}/api/auth/${provider}/callback`,
    next: null,
  });
  seededStates.push(state);
  return state;
}

async function stateExists(state: string): Promise<boolean> {
  const r = await pool.query(`SELECT 1 FROM oauth_login_states WHERE state = $1`, [state]);
  return r.rows.length > 0;
}

function errorOf(location: string | undefined): string | null {
  if (!location) return null;
  try {
    // Locations are relative ("/?error=..."); give URL a base to parse against.
    return new URL(location, "http://localhost").searchParams.get("error");
  } catch {
    return null;
  }
}

beforeAll(() => {
  for (const k of ENV_KEYS) ORIGINAL_ENV[k] = process.env[k];
  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api", authRouter);
});

afterEach(() => {
  // Provider env is unset by default for every test (the hermetic
  // "oauth_not_configured fall-through" trick). Individual tests opt back in.
  for (const k of ENV_KEYS) {
    if (ORIGINAL_ENV[k] === undefined) delete process.env[k];
    else process.env[k] = ORIGINAL_ENV[k];
  }
});

afterAll(async () => {
  if (seededStates.length > 0) {
    await pool.query(`DELETE FROM oauth_login_states WHERE state = ANY($1)`, [seededStates]);
  }
  await pool.query(`DELETE FROM oauth_login_states WHERE host = $1`, [TEST_HOST]);
});

function unconfigureProviders(): void {
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.GITHUB_OAUTH_CLIENT_ID;
  delete process.env.GITHUB_OAUTH_CLIENT_SECRET;
}

describe.each([
  { provider: "google" as const, callback: "/api/auth/google/callback" },
  { provider: "github" as const, callback: "/api/auth/github/callback" },
])("$provider OAuth callback — state CSRF gate", ({ provider, callback }) => {
  it("rejects a MISSING state with invalid_state (no token exchange)", async () => {
    unconfigureProviders();
    const res = await inject(app, { method: "GET", url: `${callback}?code=fake-code` });
    expect(res.status).toBe(302);
    expect(errorOf(res.headers["location"] as string)).toBe("invalid_state");
    // No session cookie is ever set on the rejection path.
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("rejects a FORGED state with invalid_state", async () => {
    unconfigureProviders();
    const forged = crypto.randomBytes(32).toString("hex");
    expect(await stateExists(forged)).toBe(false);
    const res = await inject(app, {
      method: "GET",
      url: `${callback}?code=fake-code&state=${forged}`,
    });
    expect(res.status).toBe(302);
    expect(errorOf(res.headers["location"] as string)).toBe("invalid_state");
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("accepts a VALID state (passes the gate, consumes the single-use nonce)", async () => {
    unconfigureProviders();
    const state = await seedValidState(provider);
    expect(await stateExists(state)).toBe(true);

    const res = await inject(app, {
      method: "GET",
      url: `${callback}?code=fake-code&state=${state}`,
    });
    expect(res.status).toBe(302);
    // Valid state is NOT rejected — it falls through to the provider-config
    // check (unset here) rather than the CSRF gate.
    expect(errorOf(res.headers["location"] as string)).toBe("oauth_not_configured");
    // The nonce was consumed (single-use) the moment it was redeemed.
    expect(await stateExists(state)).toBe(false);
  });

  it("rejects a REPLAYED state (second use of a consumed nonce)", async () => {
    unconfigureProviders();
    const state = await seedValidState(provider);

    const first = await inject(app, {
      method: "GET",
      url: `${callback}?code=fake-code&state=${state}`,
    });
    expect(errorOf(first.headers["location"] as string)).toBe("oauth_not_configured");

    const replay = await inject(app, {
      method: "GET",
      url: `${callback}?code=fake-code&state=${state}`,
    });
    expect(replay.status).toBe(302);
    expect(errorOf(replay.headers["location"] as string)).toBe("invalid_state");
    expect(replay.headers["set-cookie"]).toBeUndefined();
  });

  it("rejects a state minted for the OTHER provider (cross-provider replay)", async () => {
    unconfigureProviders();
    const otherProvider = provider === "google" ? "github" : "google";
    const state = await seedValidState(otherProvider);

    const res = await inject(app, {
      method: "GET",
      url: `${callback}?code=fake-code&state=${state}`,
    });
    expect(res.status).toBe(302);
    expect(errorOf(res.headers["location"] as string)).toBe("invalid_state");
    // The mismatched nonce is left untouched for its real provider to redeem.
    expect(await stateExists(state)).toBe(true);
  });
});

describe("OAuth initiation persists an opaque single-use nonce", () => {
  it("GET /api/auth/github stores the redirected state in oauth_login_states", async () => {
    process.env.GITHUB_OAUTH_CLIENT_ID = "test-client-id";
    process.env.GITHUB_OAUTH_CLIENT_SECRET = "test-client-secret";
    process.env.GITHUB_OAUTH_REDIRECT_URI =
      "https://app.example.test/api/auth/github/callback";

    const res = await inject(app, { method: "GET", url: "/api/auth/github" });
    expect(res.status).toBe(302);
    const location = res.headers["location"] as string;
    const url = new URL(location);
    expect(url.origin + url.pathname).toBe("https://github.com/login/oauth/authorize");
    const state = url.searchParams.get("state");
    expect(state).toBeTruthy();
    // The state param is the opaque server-stored nonce, not a decodable blob.
    expect(await stateExists(state!)).toBe(true);
    seededStates.push(state!);
  });
});
