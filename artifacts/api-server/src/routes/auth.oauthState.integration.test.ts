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
import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from "vitest";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import crypto from "node:crypto";
import { pool } from "@workspace/db";
import { inject } from "../test-utils/injectRequest";
import { mintOAuthState } from "../lib/oauthState";

// Google's callback exchanges the code and verifies the id_token through
// google-auth-library's OAuth2Client (not `fetch`). Stub the class so the
// success-path test below can drive a deterministic payload through the real
// handler without any network. The mutable holder is `vi.hoisted` so the
// (hoisted) `vi.mock` factory can read the per-test payload. The state-gate
// tests never reach this code (providers unset → handler short-circuits before
// instantiating the client), so the stub is inert for them.
const googleMock = vi.hoisted(() => ({
  payload: null as Record<string, unknown> | null,
}));

vi.mock("google-auth-library", () => ({
  OAuth2Client: class {
    generateAuthUrl(): string {
      return "https://accounts.google.com/o/oauth2/v2/auth";
    }
    async getToken(): Promise<{ tokens: { id_token: string } }> {
      return { tokens: { id_token: "fake-id-token" } };
    }
    setCredentials(): void {}
    async verifyIdToken(): Promise<{ getPayload: () => Record<string, unknown> | null }> {
      return { getPayload: () => googleMock.payload };
    }
  },
}));

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

/**
 * Success path — what the state-gate tests deliberately stop short of.
 *
 * The gate suite above falls through to `oauth_not_configured` to stay
 * hermetic, so it never exercises the rest of a successful callback: token
 * exchange, the user upsert, membership resolution, and the session-cookie +
 * `app_sessions` write. A regression there (broken upsert, missing session
 * write, dropped cookie) would slip past every test above.
 *
 * These two cases drive a VALID nonce all the way through with the providers
 * stubbed instead of unset:
 *   - GitHub uses `fetch`, so we override `global.fetch` to return the token /
 *     account / verified-email responses.
 *   - Google uses google-auth-library's OAuth2Client, stubbed at module load
 *     above (token exchange + verifyIdToken).
 *
 * Both flows run on a redirect URI whose host equals the origin host (the
 * minted state's host), so the callback takes the same-domain branch and sets
 * the `lp_sid` cookie directly on the response (no cross-domain exchange code).
 * The origin host (TEST_HOST) matches no tenant, so membership resolution
 * lands in the "open host / no membership" branch (tenantId null) — enough to
 * prove the upsert + session write run end to end. We assert the cookie is set,
 * the `app_users` row carries the provider identity, the `app_sessions` row
 * references that user, and the nonce was consumed.
 */
describe("OAuth callback success path (downstream of the state gate)", () => {
  let originalFetch: typeof globalThis.fetch;
  const createdUserIds: number[] = [];
  const createdSids: string[] = [];

  beforeAll(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    googleMock.payload = null;
  });

  afterAll(async () => {
    if (createdSids.length > 0) {
      await pool.query(`DELETE FROM app_sessions WHERE sid = ANY($1)`, [createdSids]);
    }
    if (createdUserIds.length > 0) {
      await pool.query(
        `DELETE FROM app_sessions WHERE (sess::jsonb->>'userId')::int = ANY($1)`,
        [createdUserIds],
      );
      await pool.query(`DELETE FROM app_users WHERE id = ANY($1)`, [createdUserIds]);
    }
  });

  function jsonResponse(body: unknown): Response {
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => body,
    } as unknown as Response;
  }

  // Route the GitHub callback's three REST calls (token exchange, /user,
  // /user/emails) to canned responses; throw on anything unexpected so a
  // stray network call can't pass silently.
  function installGithubFetchMock(opts: {
    githubId: string;
    email: string;
    name: string;
    avatarUrl: string;
  }): void {
    globalThis.fetch = (async (input: unknown): Promise<Response> => {
      const url = typeof input === "string" ? input : String(input);
      if (url === "https://github.com/login/oauth/access_token") {
        return jsonResponse({ access_token: "gho_fake_access_token" });
      }
      if (url === "https://api.github.com/user") {
        return jsonResponse({
          id: Number(opts.githubId),
          login: "ghtest",
          name: opts.name,
          avatar_url: opts.avatarUrl,
        });
      }
      if (url === "https://api.github.com/user/emails") {
        return jsonResponse([{ email: opts.email, primary: true, verified: true }]);
      }
      throw new Error(`Unexpected fetch in GitHub OAuth success test: ${url}`);
    }) as unknown as typeof globalThis.fetch;
  }

  function sidFromSetCookie(
    setCookie: number | string | string[] | undefined,
  ): string | undefined {
    const cookieStr = Array.isArray(setCookie) ? setCookie.join("\n") : String(setCookie ?? "");
    return /lp_sid=([^;]+)/.exec(cookieStr)?.[1];
  }

  it("GitHub: a VALID state completes token exchange, upserts the user, and sets a session", async () => {
    const email = `gh-${crypto.randomUUID()}@oauth-it.example.test`;
    const githubId = String(2_000_000_000 + Math.floor(Math.random() * 1_000_000_000));

    process.env.GITHUB_OAUTH_CLIENT_ID = "test-client-id";
    process.env.GITHUB_OAUTH_CLIENT_SECRET = "test-client-secret";
    process.env.GITHUB_OAUTH_REDIRECT_URI = `https://${TEST_HOST}/api/auth/github/callback`;

    installGithubFetchMock({
      githubId,
      email,
      name: "GH Test User",
      avatarUrl: "https://avatars.example/gh.png",
    });

    const state = await seedValidState("github");
    const res = await inject(app, {
      method: "GET",
      url: `/api/auth/github/callback?code=fake-code&state=${state}`,
    });

    // Same-domain branch → lands on root with no error param (not a rejection).
    expect(res.status).toBe(302);
    expect(errorOf(res.headers["location"] as string)).toBeNull();
    expect(res.headers["location"]).toBe("/");

    // A session cookie was issued.
    const sid = sidFromSetCookie(res.headers["set-cookie"]);
    expect(sid).toBeTruthy();
    createdSids.push(sid!);

    // The user row was created/updated with the GitHub identity.
    const userRow = await pool.query(
      `SELECT id, github_id, email, name FROM app_users WHERE email = $1`,
      [email],
    );
    expect(userRow.rows.length).toBe(1);
    expect(userRow.rows[0].github_id).toBe(githubId);
    expect(userRow.rows[0].name).toBe("GH Test User");
    createdUserIds.push(userRow.rows[0].id);

    // The session row exists for the cookie's sid and points at that user.
    const sessRow = await pool.query(`SELECT sess FROM app_sessions WHERE sid = $1`, [sid]);
    expect(sessRow.rows.length).toBe(1);
    expect((JSON.parse(sessRow.rows[0].sess) as { userId: number }).userId).toBe(
      userRow.rows[0].id,
    );

    // The nonce was consumed (single-use).
    expect(await stateExists(state)).toBe(false);
  });

  it("Google: a VALID state verifies the id_token, upserts the user, and sets a session", async () => {
    const email = `goog-${crypto.randomUUID()}@oauth-it.example.test`;
    const googleId = `google-sub-${crypto.randomUUID()}`;

    process.env.GOOGLE_CLIENT_ID = "test-google-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-google-client-secret";
    process.env.GOOGLE_REDIRECT_URI = `https://${TEST_HOST}/api/auth/google/callback`;

    googleMock.payload = {
      sub: googleId,
      email,
      name: "Goog Test User",
      picture: "https://avatars.example/goog.png",
    };

    const state = await seedValidState("google");
    const res = await inject(app, {
      method: "GET",
      url: `/api/auth/google/callback?code=fake-code&state=${state}`,
    });

    expect(res.status).toBe(302);
    expect(errorOf(res.headers["location"] as string)).toBeNull();
    expect(res.headers["location"]).toBe("/");

    const sid = sidFromSetCookie(res.headers["set-cookie"]);
    expect(sid).toBeTruthy();
    createdSids.push(sid!);

    const userRow = await pool.query(
      `SELECT id, google_id, email, name FROM app_users WHERE email = $1`,
      [email],
    );
    expect(userRow.rows.length).toBe(1);
    expect(userRow.rows[0].google_id).toBe(googleId);
    expect(userRow.rows[0].name).toBe("Goog Test User");
    createdUserIds.push(userRow.rows[0].id);

    const sessRow = await pool.query(`SELECT sess FROM app_sessions WHERE sid = $1`, [sid]);
    expect(sessRow.rows.length).toBe(1);
    expect((JSON.parse(sessRow.rows[0].sess) as { userId: number }).userId).toBe(
      userRow.rows[0].id,
    );

    expect(await stateExists(state)).toBe(false);
  });
});
