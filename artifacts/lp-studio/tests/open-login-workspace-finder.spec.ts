/**
 * Task #498 — UI coverage for the central (open-domain) login shell and the
 * workspace finder.
 *
 * The redesigned open-domain sign-in (split-screen Sign up / Log in framing
 * plus the inline workspace finder) is the highest-traffic entry point into
 * the product, but had no dedicated automated coverage. This spec locks down:
 *
 *   1. Open vs tenant-locked rendering — `domainContext.mode === "open"`
 *      renders the split-screen `OpenSignInScreen`; a tenant-locked context
 *      renders the minimal branded `SignInPanel` card (NOT the open screen).
 *   2. The Sign up / Log in toggle swaps the heading and updates aria-pressed.
 *   3. The workspace finder happy path — submitting a known workspace's slug
 *      redirects the browser to that workspace's canonical URL.
 *   4. The workspace finder not-found state — an unknown query surfaces the
 *      "couldn't find that workspace" copy and does NOT navigate.
 *
 * This is a TEST-ONLY task: it does not touch feature code. Per the task
 * brief, the `/api/auth/find-workspace` endpoint's own unit tests (incl.
 * fuzzy matching) are owned by the typo-tolerant finder task, so this spec
 * only exercises the finder's UI behaviour through the real endpoint.
 *
 * Approach:
 *  - `/api/auth/me` and `/api/auth/domain-context` are stubbed per-test so
 *    the AuthGate branch under test (open vs tenant-locked, logged-out) is
 *    driven deterministically without depending on host→tenant resolution or
 *    the server's domain-context cache.
 *  - The finder happy-path test seeds a REAL tenant (custom domain) and lets
 *    the finder hit the REAL `/api/auth/find-workspace` endpoint, so the
 *    redirect target is the server-computed canonical host — not a stub.
 *  - In dev the bare `/` renders the marketing site, so the SaaS shell (where
 *    AuthGate lives) is reached via `/?preview=app` (see App.tsx isMarketingHost).
 */
import { test, expect, type Page } from "@playwright/test";
import pg from "pg";
import { randomBytes } from "node:crypto";
import {
  createRoyalTenant,
  cleanupRoyalTenant,
  purgeStaleRoyalTenants,
  type RoyalTenant,
} from "./setup/royal-tenant";

const PORT = Number(process.env.E2E_PORT ?? "4318");
const APP = `http://127.0.0.1:${PORT}`;
// `/?preview=app` forces the SaaS shell in dev — the bare `/` renders the
// marketing site (App.tsx isMarketingHost()). AuthGate (and thus the open
// sign-in screen) only exists inside the SaaS shell.
const APP_SHELL_URL = `${APP}/?preview=app`;

const dbUrl = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error(
    "NEON_DATABASE_URL or DATABASE_URL is required for open-login-workspace-finder.spec.ts",
  );
}
const pool = new pg.Pool({ connectionString: dbUrl, max: 4 });

const OPEN_CTX = {
  mode: "open",
  tenantId: null,
  tenantName: null,
  tenantSlug: null,
  micrositeDomain: null,
} as const;

const LOCKED_CTX = {
  mode: "tenant-locked",
  tenantId: 9_999_999,
  tenantName: "Acme Dental Co",
  tenantSlug: "acme-dental",
  micrositeDomain: null,
} as const;

/**
 * Stub the two endpoints AuthGate's render decision depends on:
 *   - /api/auth/me            → 401 (logged out)
 *   - /api/auth/domain-context → the supplied mode payload
 * Everything else (incl. /api/auth/find-workspace) passes through to the
 * real api-server booted by the Playwright webServer config.
 */
async function stubLoggedOut(page: Page, domainContext: object): Promise<void> {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: "Unauthorized" }),
    }),
  );
  await page.route("**/api/auth/domain-context**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(domainContext),
    }),
  );
}

// The two split-screen Sign up / Log in toggle buttons are the only buttons
// carrying aria-pressed (the inline footer "Log in" / "Create a workspace"
// switch links do not), so this selector isolates the toggle unambiguously.
const toggle = (page: Page) => page.locator("button[aria-pressed]");

// The workspace finder now lives on the Log in tab, tucked behind a quiet
// "Find your company's login page" link that reveals it with an open/close
// animation. Reaching the finder input therefore takes two steps: switch to
// the Log in tab, then click the reveal link. (Playwright auto-waits for the
// reveal animation to settle before the finder input becomes actionable.)
async function openFinder(page: Page): Promise<void> {
  await toggle(page).filter({ hasText: "Log in" }).click();
  await page
    .getByRole("button", { name: "Find your company's login page" })
    .click();
}

test.afterAll(async () => {
  await pool.end().catch(() => undefined);
});

test.describe("Open-domain login shell — AuthGate rendering", () => {
  test("an open domain renders the split-screen open sign-in screen for a logged-out user", async ({
    browser,
  }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await stubLoggedOut(page, OPEN_CTX);
    await page.goto(APP_SHELL_URL, { waitUntil: "domcontentloaded" });

    // Split-screen open screen signals: the default "Create your workspace"
    // heading, BOTH toggle buttons, and the inline workspace finder.
    await expect(
      page.getByRole("heading", { name: "Create your workspace" }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(toggle(page).filter({ hasText: "Sign up" })).toBeVisible();
    await expect(toggle(page).filter({ hasText: "Log in" })).toBeVisible();
    await expect(page.getByText("Already have an account?")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Continue with Google" }),
    ).toBeVisible();

    // The workspace finder is reachable from the open screen: switching to the
    // Log in tab surfaces the quiet "Find your company's login page" reveal link.
    await toggle(page).filter({ hasText: "Log in" }).click();
    await expect(page.getByText("Already have a workspace?")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Find your company's login page" }),
    ).toBeVisible();

    await ctx.close();
  });

  test("a tenant-locked domain renders the minimal branded card, not the open screen", async ({
    browser,
  }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await stubLoggedOut(page, LOCKED_CTX);
    // SignInPanel fetches the tenant's published brand by host; stub it so
    // the card renders with the tenant name without a DB dependency.
    await page.route("**/api/lp/brand**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ brandName: "Acme Dental Co", logoUrl: null }),
      }),
    );
    await page.goto(APP_SHELL_URL, { waitUntil: "domcontentloaded" });

    // Minimal branded card signals: the tenant-scoped sign-in title +
    // "Sign in to continue" subtitle and "Continue with Google".
    await expect(
      page.getByRole("heading", { name: "Sign in to Acme Dental Co" }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Sign in to continue")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Continue with Google" }),
    ).toBeVisible();

    // It must NOT be the open screen: no Sign up / Log in toggle, no
    // "Create your workspace" heading, and no workspace finder.
    await expect(toggle(page)).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Create your workspace" }),
    ).toHaveCount(0);
    await expect(page.getByText("Already have a workspace?")).toHaveCount(0);

    await ctx.close();
  });

  test("the Sign up / Log in toggle swaps the heading and aria-pressed state", async ({
    browser,
  }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await stubLoggedOut(page, OPEN_CTX);
    await page.goto(APP_SHELL_URL, { waitUntil: "domcontentloaded" });

    const signupToggle = toggle(page).filter({ hasText: "Sign up" });
    const loginToggle = toggle(page).filter({ hasText: "Log in" });

    // Default: Sign up is active.
    await expect(
      page.getByRole("heading", { name: "Create your workspace" }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(signupToggle).toHaveAttribute("aria-pressed", "true");
    await expect(loginToggle).toHaveAttribute("aria-pressed", "false");

    // Toggle to Log in: heading + supporting copy flip, aria-pressed flips.
    await loginToggle.click();
    await expect(
      page.getByRole("heading", { name: "Welcome back" }),
    ).toBeVisible();
    await expect(
      page.getByText("Log in to your LP Studio workspace to keep building."),
    ).toBeVisible();
    await expect(signupToggle).toHaveAttribute("aria-pressed", "false");
    await expect(loginToggle).toHaveAttribute("aria-pressed", "true");

    // Toggle back to Sign up.
    await signupToggle.click();
    await expect(
      page.getByRole("heading", { name: "Create your workspace" }),
    ).toBeVisible();
    await expect(signupToggle).toHaveAttribute("aria-pressed", "true");
    await expect(loginToggle).toHaveAttribute("aria-pressed", "false");

    await ctx.close();
  });
});

test.describe("Workspace finder — open sign-in screen", () => {
  let tenant: RoyalTenant;
  // Custom domain so the server-computed canonical host is deterministic
  // (getCanonicalTenantHost prefers tenants.domain over <slug>.lpstudio.ai)
  // AND distinct from the request host (127.0.0.1) so the finder stays
  // enabled (it 404s when the request host itself resolves to a tenant).
  let targetHost: string;

  test.beforeAll(async ({ request }) => {
    await purgeStaleRoyalTenants(pool);
    const suffix = randomBytes(4).toString("hex");
    targetHost = `finder-${suffix}.example.com`;
    tenant = await createRoyalTenant(pool, {
      uniqueSuffix: `finder-${suffix}`,
      domain: targetHost,
      // createRoyalTenant defaults to the legacy plan="trial", which the
      // tenants_plan_canonical_check constraint now rejects (trials are a
      // date-window, never a stored plan). Pass an explicit canonical plan so
      // this spec's setup is independent of that stale default.
      plan: "growth",
    });
    // The finder's host-resolution check reads the in-process tenant cache;
    // drop it so the freshly seeded tenant is visible immediately.
    await request.post("/api/_test/invalidate-host-cache").catch(() => undefined);
  });

  test.afterAll(async () => {
    if (tenant) await cleanupRoyalTenant(pool, tenant).catch(() => undefined);
  });

  test("submitting a known workspace slug redirects to its canonical URL", async ({
    browser,
  }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await stubLoggedOut(page, OPEN_CTX);
    // Intercept the cross-origin redirect target so the assertion doesn't
    // depend on a real DNS resolution of the example.com canonical host.
    await page.route(`https://${targetHost}/**`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<html><body>Workspace login</body></html>",
      }),
    );
    await page.goto(APP_SHELL_URL, { waitUntil: "domcontentloaded" });
    await openFinder(page);

    const input = page.getByLabel("Company name or workspace");
    await expect(input).toBeVisible({ timeout: 30_000 });
    await input.fill(tenant.slug);
    await page.getByRole("button", { name: "Find" }).click();

    // The finder sets window.location.href to the canonical workspace URL.
    await page.waitForURL(`https://${targetHost}/`, { timeout: 15_000 });
    expect(page.url()).toBe(`https://${targetHost}/`);

    await ctx.close();
  });

  test("an unknown query shows the not-found message and does not navigate", async ({
    browser,
  }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await stubLoggedOut(page, OPEN_CTX);
    await page.goto(APP_SHELL_URL, { waitUntil: "domcontentloaded" });
    await openFinder(page);

    const input = page.getByLabel("Company name or workspace");
    await expect(input).toBeVisible({ timeout: 30_000 });
    await input.fill(`no-such-workspace-${randomBytes(4).toString("hex")}`);
    await page.getByRole("button", { name: "Find" }).click();

    await expect(
      page.getByText(
        "We couldn't find that workspace. Check the spelling, or ask your admin for the link.",
      ),
    ).toBeVisible({ timeout: 15_000 });

    // No navigation occurred — still on the open sign-in screen.
    expect(page.url().startsWith(APP)).toBe(true);
    await expect(
      page.getByRole("heading", { name: "Create your workspace" }),
    ).toBeVisible();

    await ctx.close();
  });

  test("debounced live suggestions appear as you type, without pressing Find", async ({
    browser,
  }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await stubLoggedOut(page, OPEN_CTX);
    await page.goto(APP_SHELL_URL, { waitUntil: "domcontentloaded" });
    await openFinder(page);

    const input = page.getByLabel("Company name or workspace");
    await expect(input).toBeVisible({ timeout: 30_000 });
    // Typing the known slug surfaces a live suggestion row — we never click
    // Find. The exact hit is rendered as a selectable option (it does NOT
    // auto-navigate mid-type).
    await input.fill(tenant.slug);

    const option = page.getByRole("option");
    await expect(option.first()).toBeVisible({ timeout: 15_000 });
    await expect(option.first()).toContainText(targetHost);

    // Still on the open sign-in screen — typing alone must not navigate.
    expect(page.url().startsWith(APP)).toBe(true);
    await expect(
      page.getByRole("heading", { name: "Create your workspace" }),
    ).toBeVisible();

    await ctx.close();
  });

  test("keyboard navigation (arrow + enter) selects a live suggestion and navigates", async ({
    browser,
  }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await stubLoggedOut(page, OPEN_CTX);
    await page.route(`https://${targetHost}/**`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<html><body>Workspace login</body></html>",
      }),
    );
    await page.goto(APP_SHELL_URL, { waitUntil: "domcontentloaded" });
    await openFinder(page);

    const input = page.getByLabel("Company name or workspace");
    await expect(input).toBeVisible({ timeout: 30_000 });
    await input.fill(tenant.slug);

    const firstOption = page.getByRole("option").first();
    await expect(firstOption).toBeVisible({ timeout: 15_000 });

    // ArrowDown highlights the first option (aria-selected flips), Enter
    // follows it to the workspace's canonical URL.
    await input.press("ArrowDown");
    await expect(firstOption).toHaveAttribute("aria-selected", "true");
    await input.press("Enter");

    await page.waitForURL(`https://${targetHost}/`, { timeout: 15_000 });
    expect(page.url()).toBe(`https://${targetHost}/`);

    await ctx.close();
  });
});
