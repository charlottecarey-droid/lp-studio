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
import { test, expect, request, type BrowserContext } from "@playwright/test";
import pg from "pg";
import {
  createRoyalTenant,
  cleanupRoyalTenant,
  purgeStaleRoyalTenants,
  type RoyalTenant,
} from "./setup/royal-tenant";

const API_PORT = process.env.E2E_API_PORT ?? "4319";
const API_BASE = `http://127.0.0.1:${API_PORT}`;

async function setSessionCookie(
  context: BrowserContext,
  sid: string,
  baseURL: string,
): Promise<void> {
  const url = new URL(baseURL);
  await context.addCookies([
    {
      name: "lp_sid",
      value: sid,
      domain: url.hostname,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure: false,
      expires: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
    },
  ]);
}

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

/**
 * Task #165 — When a state-changing request fails CSRF (e.g. the lp_csrf
 * cookie has fallen out of sync with the in-memory token after an idle
 * period or a server restart), the global fetch interceptor in
 * `src/lib/api-fetch.ts` must transparently re-fetch a fresh token and
 * retry the original request once before bubbling the failure to the UI.
 *
 * We exercise this end-to-end inside a real browser context (so the wrapper
 * actually runs) by:
 *   1. Booting the app — the wrapper warms a token + cookie pair.
 *   2. Corrupting `lp_csrf` so the next state-changing POST will 403.
 *   3. Firing a POST through `window.fetch` and asserting:
 *        a) the final response is 2xx (the user sees no error),
 *        b) we observed a 403 followed by a /api/auth/csrf refetch and a
 *           successful retry of the original request.
 */
test("a stale CSRF cookie auto-refreshes and the original request retries transparently", async ({
  browser,
  baseURL,
}) => {
  expect(baseURL, "playwright baseURL must be configured").toBeTruthy();

  // Use a fresh session so the rest of the file (which mutates `tenant`)
  // can't strand this test on a logged-out sid.
  const liveTenant = await createRoyalTenant(pool);
  try {
    const context = await browser.newContext({ baseURL });
    await setSessionCookie(context, liveTenant.sessionSid, baseURL!);
    const page = await context.newPage();

    // Track every /api/* response so we can reconstruct the recovery flow.
    type Hit = { url: string; status: number; method: string };
    const hits: Hit[] = [];
    page.on("response", (resp) => {
      const req = resp.request();
      const u = req.url();
      if (!u.includes("/api/")) return;
      hits.push({ url: u, status: resp.status(), method: req.method() });
    });

    // Boot the app. main.tsx installs the interceptor and calls
    // ensureCsrfToken(), so by the time this resolves the wrapper has a
    // cached token and the browser jar holds a matching lp_csrf cookie.
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForResponse(
      (r) => r.url().includes("/api/auth/csrf") && r.ok(),
      { timeout: 30_000 },
    );

    // Sanity: lp_csrf is present.
    const cookiesBefore = await context.cookies();
    const csrfBefore = cookiesBefore.find((c) => c.name === "lp_csrf");
    expect(csrfBefore, "wrapper should have set lp_csrf on boot").toBeTruthy();

    // Corrupt the cookie. The in-memory token cached by the wrapper is
    // unchanged, so the next POST will send a header that *looks* well-formed
    // but won't decode against this bogus cookie → server returns 403.
    await context.clearCookies({ name: "lp_csrf" });
    await context.addCookies([
      {
        name: "lp_csrf",
        value: "stale-bogus-cookie-value",
        domain: csrfBefore!.domain,
        path: csrfBefore!.path,
        httpOnly: true,
        sameSite: "Strict",
        secure: false,
        expires: Math.floor(Date.now() / 1000) + 60 * 60,
      },
    ]);

    // Reset the hit log so we only capture network from the recovery flow.
    hits.length = 0;

    // Fire the state-changing call from inside the page so window.fetch
    // (the patched one) is on the call path. POST /api/lp/pages is a real,
    // cookie-authed, CSRF-protected endpoint.
    const slug = `csrf-retry-${Date.now().toString(36)}`;
    const result = await page.evaluate(async (s) => {
      const r = await fetch("/api/lp/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: "CSRF Retry", slug: s, blocks: [], status: "draft" }),
      });
      const text = await r.text();
      return { status: r.status, body: text };
    }, slug);

    // (a) The user-visible response is success — the retry papered over the
    // stale-token 403.
    expect(
      result.status,
      `expected POST /api/lp/pages to recover, got ${result.status}: ${result.body}`,
    ).toBeLessThan(400);

    // (b) The observed network sequence proves the recovery actually
    // happened (and didn't silently succeed for some other reason).
    const pageHits = hits.filter((h) => h.url.includes("/api/lp/pages") && h.method === "POST");
    const csrfRefetch = hits.filter(
      (h) => h.url.includes("/api/auth/csrf") && h.method === "GET" && h.status >= 200 && h.status < 300,
    );
    expect(
      pageHits.length,
      `expected two POST /api/lp/pages attempts (one 403, one retry), got ${JSON.stringify(pageHits)}`,
    ).toBe(2);
    expect(pageHits[0].status, "first attempt should have failed CSRF with 403").toBe(403);
    expect(pageHits[1].status, "retry should have succeeded").toBeLessThan(400);
    expect(
      csrfRefetch.length,
      "expected the wrapper to GET /api/auth/csrf to refresh the token between attempts",
    ).toBeGreaterThanOrEqual(1);

    // Cleanup: drop the page row this test created so reruns don't trip
    // over a unique-slug collision.
    const newPageId = (() => {
      try {
        return (JSON.parse(result.body) as { id?: number }).id;
      } catch {
        return undefined;
      }
    })();
    if (typeof newPageId === "number") {
      await pool.query(`DELETE FROM lp_pages WHERE id = $1`, [newPageId]).catch(() => undefined);
    }

    await context.close();
  } finally {
    await cleanupRoyalTenant(pool, liveTenant).catch(() => undefined);
  }
});

/**
 * Counterpart to the recovery test: if the retry *also* fails (e.g. the
 * server is genuinely rejecting the session), the wrapper must surface the
 * 403 instead of looping or swallowing it. We force this by rebinding the
 * session cookie to "anonymous" before the call so even a freshly-issued
 * token will be bound to a different identifier than the one the POST
 * carries.
 *
 * NOTE: We can't easily simulate "two consecutive 403s on the same endpoint"
 * from the browser without mocking, because the wrapper's refetch always
 * succeeds against the live api-server. We instead assert the simpler
 * contract: when no recovery is possible, the user-visible response is the
 * 403 (i.e. the wrapper does not invent a 2xx).
 */
test("if the refresh + retry still fails, the 403 surfaces to the caller", async ({
  browser,
  baseURL,
}) => {
  expect(baseURL, "playwright baseURL must be configured").toBeTruthy();

  const context = await browser.newContext({ baseURL });
  // Intentionally do NOT set lp_sid: the wrapper will fetch a CSRF token
  // bound to "anonymous", but the POST will still go through and the
  // route's auth middleware will return 401 without a session. That's not
  // what we want — we want a CSRF 403 specifically, so we instead use a
  // fresh tenant + corrupt the cookie *and* poison the wrapper's recovery
  // by intercepting /api/auth/csrf to return a stale token.
  const liveTenant = await createRoyalTenant(pool);
  try {
    await setSessionCookie(context, liveTenant.sessionSid, baseURL!);
    const page = await context.newPage();

    // Force every /api/auth/csrf response to hand back a token+cookie that
    // do NOT match each other, so neither the original nor the retry can
    // pass server-side verification.
    await page.route("**/api/auth/csrf", async (route) => {
      const res = await route.fetch();
      const body = await res.json();
      const headers = { ...res.headers() };
      // Replace the Set-Cookie header with a bogus lp_csrf so cookie/header
      // never agree.
      headers["set-cookie"] = "lp_csrf=permanently-broken; Path=/; HttpOnly; SameSite=Strict";
      await route.fulfill({
        status: res.status(),
        headers,
        body: JSON.stringify(body),
      });
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForResponse(
      (r) => r.url().includes("/api/auth/csrf"),
      { timeout: 30_000 },
    );

    // Track POST attempts so we can assert the wrapper retries *exactly once*
    // before giving up — the contract is "refresh + retry once", not "loop
    // until success".
    const pageAttempts: number[] = [];
    page.on("response", (resp) => {
      const req = resp.request();
      if (req.method() !== "POST") return;
      if (!req.url().includes("/api/lp/pages")) return;
      pageAttempts.push(resp.status());
    });

    const slug = `csrf-fail-${Date.now().toString(36)}`;
    const result = await page.evaluate(async (s) => {
      const r = await fetch("/api/lp/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: "CSRF Fail", slug: s, blocks: [], status: "draft" }),
      });
      const text = await r.text();
      return { status: r.status, body: text };
    }, slug);

    expect(result.status, `expected the unrecoverable failure to surface as 403, got ${result.status}: ${result.body}`).toBe(403);
    expect(String(result.body).toLowerCase()).toContain("csrf");

    // Retry-once contract: original attempt + at most one retry. Any more
    // and the wrapper would be looping.
    expect(
      pageAttempts.length,
      `expected at most 2 POST attempts (original + single retry), got ${JSON.stringify(pageAttempts)}`,
    ).toBeLessThanOrEqual(2);
    expect(pageAttempts[0], "first attempt should have failed CSRF with 403").toBe(403);

    await context.close();
  } finally {
    await cleanupRoyalTenant(pool, liveTenant).catch(() => undefined);
  }
});
