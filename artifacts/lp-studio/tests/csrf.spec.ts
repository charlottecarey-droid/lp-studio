/**
 * Task #149 — CSRF protection on cookie-authed endpoints.
 *
 * Verifies the three pillars of the double-submit pattern installed in
 * artifacts/api-server/src/lib/csrf.ts:
 *
 *   1. GET requests work without a CSRF token (safe methods are exempt).
 *   2. State-changing requests with a session cookie but no CSRF token are
 *      rejected with 403.
 *   3. State-changing requests carrying both the `lp_csrf` cookie and a
 *      matching `X-CSRF-Token` header succeed.
 */
import { test, expect, request } from "@playwright/test";
import pg from "pg";
import {
  createRoyalTenant,
  cleanupRoyalTenant,
  purgeStaleRoyalTenants,
  type RoyalTenant,
} from "./setup/royal-tenant";

const API_PORT = process.env.E2E_API_PORT ?? "4319";
const API_BASE = `http://127.0.0.1:${API_PORT}`;

let pool: pg.Pool;
let tenant: RoyalTenant;

test.beforeAll(async () => {
  // The api-server reads NEON_DATABASE_URL first (with DATABASE_URL as
  // fallback); mirror that here so the test fixture writes to the same DB the
  // api-server will read from when validating the session cookie.
  const dbUrl = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error("NEON_DATABASE_URL or DATABASE_URL is required for csrf.spec.ts");
  }
  pool = new pg.Pool({ connectionString: dbUrl });
  await purgeStaleRoyalTenants(pool);
  tenant = await createRoyalTenant(pool);
});

test.afterAll(async () => {
  if (tenant) await cleanupRoyalTenant(pool, tenant).catch(() => undefined);
  await pool.end();
});

test("GET requests work without a CSRF token", async () => {
  const ctx = await request.newContext({
    baseURL: API_BASE,
    extraHTTPHeaders: { cookie: `lp_sid=${tenant.sessionSid}` },
  });
  const res = await ctx.get("/api/auth/me");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.email).toBe(tenant.email);
  await ctx.dispose();
});

test("state-changing request without CSRF token returns 403", async () => {
  const ctx = await request.newContext({
    baseURL: API_BASE,
    extraHTTPHeaders: { cookie: `lp_sid=${tenant.sessionSid}` },
  });
  // Hit a real cookie-authed endpoint to prove it's the CSRF gate failing,
  // not a route-level auth check.
  const res = await ctx.post("/api/auth/logout", { data: {} });
  expect(res.status()).toBe(403);
  const body = await res.json();
  expect(String(body.error).toLowerCase()).toContain("csrf");
  await ctx.dispose();
});

test("state-changing request with valid CSRF token succeeds", async () => {
  const ctx = await request.newContext({ baseURL: API_BASE });

  // Fetch the token. Pass lp_sid so getSessionIdentifier binds the token to
  // this session — otherwise it would be bound to "anonymous" and the
  // follow-up POST (which carries lp_sid) would mismatch.
  const tokenRes = await ctx.get("/api/auth/csrf", {
    headers: { cookie: `lp_sid=${tenant.sessionSid}` },
  });
  expect(tokenRes.ok()).toBe(true);
  const { csrfToken } = (await tokenRes.json()) as { csrfToken: string };
  expect(csrfToken).toBeTruthy();

  // Pull the lp_csrf cookie off the Set-Cookie header so we can echo it back.
  const setCookies = tokenRes.headersArray().filter(
    (h) => h.name.toLowerCase() === "set-cookie",
  );
  const csrfSetCookie = setCookies.find((h) => h.value.startsWith("lp_csrf="));
  expect(csrfSetCookie, "expected lp_csrf cookie on /api/auth/csrf response").toBeTruthy();
  const csrfCookieValue = csrfSetCookie!.value.split(";")[0]; // "lp_csrf=<value>"

  const logoutRes = await ctx.post("/api/auth/logout", {
    headers: {
      cookie: `lp_sid=${tenant.sessionSid}; ${csrfCookieValue}`,
      "x-csrf-token": csrfToken,
    },
    data: {},
  });
  expect(logoutRes.status()).toBe(200);
  const body = await logoutRes.json();
  expect(body.ok).toBe(true);

  await ctx.dispose();
  // Logout deleted this session; reissue so any subsequent test in the file
  // (or test reruns) get a fresh, valid one.
  tenant = await createRoyalTenant(pool);
});
