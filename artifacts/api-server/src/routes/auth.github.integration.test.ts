/**
 * Integration tests for the "Sign in with GitHub" OAuth initiation surface.
 *
 * Runs the REAL auth router, injecting requests IN-PROCESS (the vitest worker
 * pool never fires `app.listen`'s callback, so a real port + fetch would hang —
 * see test-utils/injectRequest). The full middleware chain runs (cookie-parser,
 * body parsing, the oauthInitLimiter, the route handlers).
 *
 * Only the initiation half is exercised here — it is pure (env in, redirect
 * out) and never touches GitHub or the DB. The callback half makes live GitHub
 * REST calls + writes a session, so it is not unit-testable without mocking the
 * whole provider; it is covered by the manual dev round-trip instead.
 *
 * Asserted branches (the config gate is easy to regress):
 *   1. /github/config reports enabled=false when the provider is unconfigured
 *      and enabled=true once the client id + secret are present.
 *   2. GET /auth/github returns 503 when unconfigured (never redirects to a
 *      half-built GitHub URL).
 *   3. GET /auth/github 302-redirects to github.com/login/oauth/authorize with
 *      the configured client_id, redirect_uri, the read:user+user:email scope,
 *      and a state param when configured.
 */
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { dbAvailable } from "../test-utils/dbAvailable";

const { inject } = await import("../test-utils/injectRequest");
const authRouter = (await import("./auth")).default;

const ENV_KEYS = [
  "GITHUB_OAUTH_CLIENT_ID",
  "GITHUB_OAUTH_CLIENT_SECRET",
  "GITHUB_OAUTH_REDIRECT_URI",
] as const;

const ORIGINAL_ENV: Record<string, string | undefined> = {};

let app: Express;

function configureGithub(): void {
  process.env.GITHUB_OAUTH_CLIENT_ID = "test-client-id";
  process.env.GITHUB_OAUTH_CLIENT_SECRET = "test-client-secret";
  process.env.GITHUB_OAUTH_REDIRECT_URI =
    "https://app.example.test/api/auth/github/callback";
}

function unconfigureGithub(): void {
  delete process.env.GITHUB_OAUTH_CLIENT_ID;
  delete process.env.GITHUB_OAUTH_CLIENT_SECRET;
  delete process.env.GITHUB_OAUTH_REDIRECT_URI;
}

beforeAll(() => {
  for (const k of ENV_KEYS) ORIGINAL_ENV[k] = process.env[k];
  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api", authRouter);
});

afterEach(() => {
  // Restore the original env after every test so suites stay independent.
  for (const k of ENV_KEYS) {
    if (ORIGINAL_ENV[k] === undefined) delete process.env[k];
    else process.env[k] = ORIGINAL_ENV[k];
  }
});

describe("GET /api/auth/github/config", () => {
  it("reports enabled=false when GitHub OAuth is unconfigured", async () => {
    unconfigureGithub();
    const res = await inject(app, { method: "GET", url: "/api/auth/github/config" });
    expect(res.status).toBe(200);
    expect((res.json as { enabled?: boolean }).enabled).toBe(false);
  });

  it("reports enabled=true when GitHub OAuth is configured", async () => {
    configureGithub();
    const res = await inject(app, { method: "GET", url: "/api/auth/github/config" });
    expect(res.status).toBe(200);
    expect((res.json as { enabled?: boolean }).enabled).toBe(true);
  });
});

describe("GET /api/auth/github — initiation", () => {
  it("returns 503 and does not redirect when GitHub OAuth is unconfigured", async () => {
    unconfigureGithub();
    const res = await inject(app, { method: "GET", url: "/api/auth/github" });
    expect(res.status).toBe(503);
    expect((res.json as { error?: string }).error).toMatch(/not configured/i);
  });

  // The initiation handler persists the single-use state nonce in oauth_states
  // (real Postgres) before redirecting, so this branch needs a reachable DB —
  // the config/unconfigured branches above stay pure env-in/response-out.
  it.skipIf(!dbAvailable)("302-redirects to GitHub's authorize endpoint with the right params when configured", async () => {
    configureGithub();
    const res = await inject(app, { method: "GET", url: "/api/auth/github" });
    expect(res.status).toBe(302);

    const location = res.headers["location"] as string;
    expect(typeof location).toBe("string");
    const url = new URL(location);
    expect(url.origin + url.pathname).toBe("https://github.com/login/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("test-client-id");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://app.example.test/api/auth/github/callback",
    );
    expect(url.searchParams.get("scope")).toBe("read:user user:email");
    // state is an opaque base64url blob — assert it exists and is non-empty.
    expect((url.searchParams.get("state") ?? "").length).toBeGreaterThan(0);
  });
});
