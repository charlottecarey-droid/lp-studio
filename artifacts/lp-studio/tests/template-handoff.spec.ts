// End-to-end check for the marketing "Use this template" handoff.
//
// Task #941 wired the marketing homepage's featured-template cards so that
// clicking "Use this template" sends the visitor to
// app.lpstudio.ai/?template={id}&utm_*=…. The SaaS root route bridges that
// `?template=` param over to the pages gallery (surviving login/signup because
// the whole query string is preserved across the auth redirects), and the
// gallery then clones the matching built-in LP_TEMPLATES template into the
// tenant and opens the new page in the builder.
//
// This flow spans the marketing site, the auth/redirect bridge, and the app,
// so a future change can break it silently. This spec exercises the
// post-auth half of the flow as a real logged-in tenant (we inject a seeded
// session cookie rather than driving Google/GitHub OAuth, which can't run
// headlessly) and asserts:
//   1. a valid `?template=` id clones the template and lands the user in the
//      builder with a freshly-created page;
//   2. an unknown id falls back gracefully to the gallery with no error state;
//   3. the `?template=` param is stripped after consumption while any `utm_*`
//      params are left intact.
//
// In dev/e2e there is no separate app host, so `?preview=app` forces the SaaS
// app shell at `/` instead of the marketing site (see isMarketingHost() in
// App.tsx). It rides along through the redirect/strip and is otherwise inert.

import pg from "pg";
import { test, expect, type Page, type BrowserContext } from "./setup/pw";
import {
  createRoyalTenant,
  cleanupRoyalTenant,
  purgeStaleRoyalTenants,
  type RoyalTenant,
} from "./setup/royal-tenant";

const { Pool } = pg;

// Must match a real built-in template id (templates.ts → LP_TEMPLATES) and its
// display title. The gallery handoff clones via getTemplateById(id) and titles
// the new page with the template's `name`.
const TEMPLATE_ID = "video-hero";
const TEMPLATE_NAME = "Video Hero";

const UTM = "utm_source=marketing&utm_medium=template_card";

function getDatabaseUrl(): string {
  const url = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "NEON_DATABASE_URL / DATABASE_URL must be set so the tenant fixture can " +
        "create a Royal-style tenant in the dev DB.",
    );
  }
  return url;
}

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

/**
 * Wait for `selector` and surface a useful diagnostic on timeout. The default
 * Playwright TimeoutError only says "selector not found" — without the page
 * state it is nearly impossible to tell whether auth, the lazy chunk, or an
 * API call regressed.
 */
async function waitForSelectorWithDiagnostics(
  page: Page,
  selector: string,
  timeoutMs: number,
  surface: string,
): Promise<void> {
  try {
    await page.waitForSelector(selector, { timeout: timeoutMs });
  } catch (err) {
    let bodyText = "";
    let title = "";
    try {
      title = await page.title();
      bodyText = (await page.locator("body").innerText({ timeout: 2_000 })).slice(0, 800);
    } catch {
      /* fall through */
    }
    throw new Error(
      `Timed out waiting for "${selector}" on ${surface} (${timeoutMs}ms).\n` +
        `URL: ${page.url()}\n` +
        `Page title: ${JSON.stringify(title)}\n` +
        `Body text snapshot:\n${bodyText}\n` +
        `Original error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

test.describe("Marketing 'Use this template' handoff", () => {
  let pool: pg.Pool;
  let tenant: RoyalTenant;

  test.beforeAll(async ({ request }) => {
    pool = new Pool({ connectionString: getDatabaseUrl(), max: 4 });
    await purgeStaleRoyalTenants(pool);
    tenant = await createRoyalTenant(pool);
    // The api-server caches tenants by host for 60s; a freshly-inserted
    // tenants.domain="localhost" row can be invisible to findTenantByHost
    // after earlier specs warm the cache. Invalidate so the authed pages
    // routes resolve this tenant. (Best-effort dev-only endpoint.)
    await request.post("/api/_test/invalidate-host-cache").catch(() => undefined);
  });

  test.afterAll(async () => {
    if (tenant && pool) {
      await cleanupRoyalTenant(pool, tenant);
    }
    if (pool) {
      await pool.end();
    }
  });

  test("through sign-in: the template id + utm_* round-trip across the login hop into the builder", async ({
    page,
    context,
    request,
    baseURL,
  }) => {
    // The end-to-end risk this task targets is the cross-boundary handoff: the
    // `?template=` (and utm_*) query string surviving a login/sign-up and then
    // being consumed. We start UNAUTHENTICATED here and go through the actual
    // sign-in hop. Headless OAuth can't run, so we simulate ONLY the provider
    // callback's net effect — set the session + redirect back to `next` — while
    // AuthGate's real `next`-building code runs unmodified. That exercises:
    //   - RootRoute bridging /?template=… → /pages?template=…
    //   - AuthGate preserving the full query string in the OAuth `next` param
    //   - the post-login landing consuming the template into the builder
    test.slow();
    expect(baseURL, "playwright baseURL must be configured").toBeTruthy();

    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    let capturedNext: string | null = null;
    // Stand in for the OAuth provider + callback. When AuthGate sends the
    // browser to /api/auth/google?next=…, capture the next param it built, set
    // the seeded tenant session cookie (what the real callback does on
    // success), and 302 back to that next URL.
    await page.route("**/api/auth/google**", async (route) => {
      const u = new URL(route.request().url());
      capturedNext = u.searchParams.get("next");
      await setSessionCookie(context, tenant.sessionSid, baseURL!);
      await route.fulfill({
        status: 302,
        headers: { location: capturedNext ?? "/" },
        body: "",
      });
    });

    // Enter exactly where the marketing card lands an unauthenticated visitor.
    await page.goto(`/?preview=app&template=${TEMPLATE_ID}&${UTM}`, {
      waitUntil: "domcontentloaded",
    });

    // With no session, RootRoute bridges to /pages?… and AuthGate shows the
    // sign-in screen. Drive the Google button — its onClick builds the `next`
    // param from the current path+query, which our route handler intercepts.
    const googleBtn = page.getByRole("button", { name: /continue with google/i });
    await expect(
      googleBtn.first(),
      "the sign-in screen should render a Google button for the unauthenticated handoff",
    ).toBeVisible({ timeout: 60_000 });
    await googleBtn.first().click();

    // After the simulated login hop the visitor lands back, now authenticated,
    // and the handoff clones the template + opens the builder.
    await page.waitForURL(/\/builder\/\d+(?:\?|#|$)/, { timeout: 120_000 });

    // Query continuity across the auth hop: the `next` AuthGate built must have
    // carried the template id AND the marketing utm params.
    expect(capturedNext, "AuthGate must preserve the query string in the OAuth next param").toBeTruthy();
    const nextParams = new URL(capturedNext!, baseURL!).searchParams;
    expect(nextParams.get("template"), "template id must survive into the login hop").toBe(
      TEMPLATE_ID,
    );
    expect(nextParams.get("utm_source"), "utm_source must survive into the login hop").toBe(
      "marketing",
    );
    expect(nextParams.get("utm_medium"), "utm_medium must survive into the login hop").toBe(
      "template_card",
    );

    // The param is consumed by the time the builder opens.
    expect(page.url(), "template param must be consumed before the builder").not.toContain(
      "template=",
    );

    // Confirm a page was genuinely cloned for THIS tenant, titled after the
    // template, via the live API (same auth path the UI uses).
    const pagesRes = await request.get("/api/lp/pages", {
      headers: { Cookie: `lp_sid=${tenant.sessionSid}` },
    });
    expect(
      pagesRes.ok(),
      `pages read failed: ${pagesRes.status()} ${await pagesRes.text()}`,
    ).toBe(true);
    const pages = (await pagesRes.json()) as Array<{ title: string }>;
    expect(
      pages.some((p) => p.title === TEMPLATE_NAME),
      `expected a page titled "${TEMPLATE_NAME}" cloned from the template; got: ${
        pages.map((p) => p.title).join(", ") || "(none)"
      }`,
    ).toBeTruthy();

    expect(
      pageErrors,
      `uncaught page errors during the sign-in handoff:\n  ${pageErrors.join("\n  ")}`,
    ).toEqual([]);
  });

  test("post-auth: a valid template id clones the template and lands in the builder", async ({
    page,
    context,
    request,
    baseURL,
  }) => {
    // Fast, stable post-auth regression check: a logged-in user (seeded session
    // cookie) hitting the same landing URL is cloned into the builder. Pairs
    // with the through-sign-in test above, which covers the auth boundary.
    // When the spec runs in isolation it also eats the api-server/vite cold
    // boot; triple the default 90s cap so a cold start can't trip the waits.
    test.slow();
    expect(baseURL, "playwright baseURL must be configured").toBeTruthy();
    await setSessionCookie(context, tenant.sessionSid, baseURL!);

    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    // Enter exactly as the marketing card link does: the SaaS root with the
    // template id + marketing UTM params. `preview=app` forces the app shell
    // in dev (no separate app host).
    await page.goto(`/?preview=app&template=${TEMPLATE_ID}&${UTM}`, {
      waitUntil: "domcontentloaded",
    });

    // RootRoute bridges to /pages?…; the gallery handoff clones the template
    // and navigates to the builder. Landing on /builder/:id is the success
    // signal.
    await page.waitForURL(/\/builder\/\d+(?:\?|#|$)/, { timeout: 120_000 });
    expect(page.url(), "should land in the builder after the handoff").toMatch(
      /\/builder\/\d+/,
    );
    // The `?template=` param must not survive into the builder URL.
    expect(page.url(), "template param must be consumed before the builder").not.toContain(
      "template=",
    );

    // The builder canvas mounts `<div data-lp-page>` once page + brand fetches
    // resolve — confirms the cloned page actually rendered, not just a route
    // change.
    await waitForSelectorWithDiagnostics(page, "[data-lp-page]", 60_000, "builder");

    // Confirm a page was genuinely cloned for THIS tenant via the live API
    // (same auth path the UI uses), titled after the template.
    const pagesRes = await request.get("/api/lp/pages", {
      headers: { Cookie: `lp_sid=${tenant.sessionSid}` },
    });
    expect(
      pagesRes.ok(),
      `pages read failed: ${pagesRes.status()} ${await pagesRes.text()}`,
    ).toBe(true);
    const pages = (await pagesRes.json()) as Array<{ title: string; status: string }>;
    const cloned = pages.find((p) => p.title === TEMPLATE_NAME);
    expect(
      cloned,
      `expected a page titled "${TEMPLATE_NAME}" cloned from the template; got: ${
        pages.map((p) => p.title).join(", ") || "(none)"
      }`,
    ).toBeTruthy();

    expect(
      pageErrors,
      `uncaught page errors during the handoff:\n  ${pageErrors.join("\n  ")}`,
    ).toEqual([]);
  });

  test("an unknown id falls back to the gallery, stripping ?template= but keeping utm_*", async ({
    page,
    context,
    baseURL,
  }) => {
    expect(baseURL, "playwright baseURL must be configured").toBeTruthy();
    await setSessionCookie(context, tenant.sessionSid, baseURL!);

    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.goto(`/?preview=app&template=does-not-exist&${UTM}`, {
      waitUntil: "domcontentloaded",
    });

    // No clone, no builder navigation — the user stays on the gallery. The
    // "Pages" heading is the stable gallery anchor; reaching it (and never
    // /builder/:id) proves the graceful fallback with no error screen.
    await waitForSelectorWithDiagnostics(
      page,
      "h1:has-text('Pages')",
      30_000,
      "pages gallery (unknown-template fallback)",
    );
    expect(page.url(), "unknown id must not navigate to the builder").not.toMatch(
      /\/builder\/\d+/,
    );

    // The handoff strips `?template=` immediately on consumption (even for an
    // unknown id) while leaving the marketing UTM params intact. Poll because
    // the strip happens in an effect after the pages list resolves.
    await expect
      .poll(() => new URL(page.url()).searchParams.has("template"), {
        timeout: 10_000,
        message: "?template= should be stripped after consumption",
      })
      .toBe(false);

    const params = new URL(page.url()).searchParams;
    expect(params.get("utm_source"), "utm_source must survive the handoff").toBe("marketing");
    expect(params.get("utm_medium"), "utm_medium must survive the handoff").toBe(
      "template_card",
    );

    expect(
      pageErrors,
      `uncaught page errors during the fallback:\n  ${pageErrors.join("\n  ")}`,
    ).toEqual([]);
  });
});
