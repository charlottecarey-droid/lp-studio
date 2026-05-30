/**
 * Task #520 — UI coverage for the post-login AuthGate branches.
 *
 * Task #498 locked down the *logged-out* central login and workspace finder.
 * The AuthGate has two more user-facing branches that fire *after* Google
 * sign-in but *before* the user is inside a workspace (`user` is set but
 * `user.tenantId` is null), and neither was covered:
 *
 *   1. Open domain, signed in, no tenant → the "Create your workspace" form
 *      (CreateWorkspaceForm) so a brand-new user can spin up their first
 *      workspace, plus the "Sign out" escape hatch.
 *   2. Tenant-locked domain, signed in, not a member → the invite-only
 *      "Access Pending" card asking the user to have an admin invite them
 *      (NOT the self-serve create-workspace form).
 *
 * These are the screens every new user hits, so regressions here silently
 * break first-time onboarding.
 *
 * This is a TEST-ONLY task: it does not touch feature code.
 *
 * Approach (mirrors open-login-workspace-finder.spec.ts):
 *  - `/api/auth/me` is stubbed to return a *signed-in* user whose
 *    `tenantId` is null, and `/api/auth/domain-context` is stubbed to pick
 *    the branch under test (open vs tenant-locked). Both are driven
 *    deterministically so the test never depends on host→tenant resolution,
 *    a real session cookie, or the domain-context cache.
 *  - In dev the bare `/` renders the marketing site, so the SaaS shell
 *    (where AuthGate lives) is reached via `/?preview=app` (see App.tsx
 *    isMarketingHost()).
 */
import { test, expect, type Page } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? "4318");
const APP = `http://127.0.0.1:${PORT}`;
// `/?preview=app` forces the SaaS shell in dev — the bare `/` renders the
// marketing site (App.tsx isMarketingHost()). AuthGate only lives inside the
// SaaS shell.
const APP_SHELL_URL = `${APP}/?preview=app`;

const SIGNED_IN_NO_TENANT = {
  userId: 4242,
  email: "newcomer@example.com",
  name: "New Comer",
  avatarUrl: null,
  tenantId: null,
  role: "member",
  permissions: {},
  isAdmin: false,
} as const;

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
 *   - /api/auth/me             → a signed-in user with tenantId: null
 *   - /api/auth/domain-context → the supplied mode payload
 * Everything else passes through to the real api-server.
 */
async function stubSignedInNoTenant(
  page: Page,
  domainContext: object,
): Promise<void> {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(SIGNED_IN_NO_TENANT),
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

/**
 * Like stubSignedInNoTenant, but models the full sign-out round-trip:
 *   - /api/auth/me starts signed-in, then flips to 401 once /api/auth/logout
 *     has been hit (the logout handler does POST /api/auth/logout then
 *     window.location.reload(); the reload re-probes /api/auth/me).
 *   - /api/auth/logout is intercepted so the real session pool isn't touched;
 *     hitting it flips the `me` stub to logged-out.
 *   - /api/auth/domain-context keeps returning the supplied mode payload so
 *     the post-reload render picks the matching logged-out screen.
 */
async function stubSignedInUntilLogout(
  page: Page,
  domainContext: object,
): Promise<void> {
  let loggedOut = false;
  await page.route("**/api/auth/me", (route) =>
    route.fulfill(
      loggedOut
        ? {
            status: 401,
            contentType: "application/json",
            body: JSON.stringify({ error: "Unauthorized" }),
          }
        : {
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(SIGNED_IN_NO_TENANT),
          },
    ),
  );
  await page.route("**/api/auth/logout", (route) => {
    loggedOut = true;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });
  await page.route("**/api/auth/domain-context**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(domainContext),
    }),
  );
}

// The two split-screen Sign up / Log in toggle buttons are the only buttons
// carrying aria-pressed, so this selector isolates the logged-out OpenSignInScreen
// (it has no "Signed in as" line, unlike the signed-in CreateWorkspaceForm).
const toggle = (page: Page) => page.locator("button[aria-pressed]");

test.describe("Post-login AuthGate — signed in, no workspace yet", () => {
  test("an open domain shows the Create-your-workspace form (and Sign out)", async ({
    browser,
  }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await stubSignedInNoTenant(page, OPEN_CTX);
    await page.goto(APP_SHELL_URL, { waitUntil: "domcontentloaded" });

    // CreateWorkspaceForm signals: the "Create your workspace" heading, the
    // "Signed in as <email>" line (this branch only renders for a signed-in
    // user — distinct from the logged-out open screen which has no email),
    // both workspace fields, and the Create button.
    await expect(
      page.getByRole("heading", { name: "Create your workspace" }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Signed in as")).toBeVisible();
    await expect(page.getByText(SIGNED_IN_NO_TENANT.email)).toBeVisible();
    await expect(page.getByLabel("Workspace name")).toBeVisible();
    await expect(page.getByLabel("Workspace URL")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Create workspace" }),
    ).toBeVisible();

    // The escape hatch — a signed-in user with no workspace can sign back out.
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();

    // It must NOT be the invite-only Access Pending card.
    await expect(
      page.getByRole("heading", { name: "Access Pending" }),
    ).toHaveCount(0);

    await ctx.close();
  });

  test("a tenant-locked domain shows the Access Pending invite card, not the create form", async ({
    browser,
  }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await stubSignedInNoTenant(page, LOCKED_CTX);
    await page.goto(APP_SHELL_URL, { waitUntil: "domcontentloaded" });

    // Access Pending card signals: the heading, the "Ask an admin to invite
    // you" copy, the signed-in email, and the Sign out action.
    await expect(
      page.getByRole("heading", { name: "Access Pending" }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Ask an admin to invite you")).toBeVisible();
    await expect(page.getByText(SIGNED_IN_NO_TENANT.email)).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();

    // It must NOT be the self-serve create-workspace form: no create heading,
    // no workspace-name field, no Create button.
    await expect(
      page.getByRole("heading", { name: "Create your workspace" }),
    ).toHaveCount(0);
    await expect(page.getByLabel("Workspace name")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Create workspace" }),
    ).toHaveCount(0);

    await ctx.close();
  });

  test("signing out from the open create-workspace screen returns to the logged-out open sign-in screen", async ({
    browser,
  }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await stubSignedInUntilLogout(page, OPEN_CTX);
    await page.goto(APP_SHELL_URL, { waitUntil: "domcontentloaded" });

    // Start on the signed-in create-workspace form.
    await expect(
      page.getByRole("heading", { name: "Create your workspace" }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Signed in as")).toBeVisible();

    // Clicking Sign out must POST /api/auth/logout, then reload into the
    // logged-out screen. Arm the request expectation before the click.
    const logoutRequest = page.waitForRequest(
      (req) =>
        req.method() === "POST" && req.url().includes("/api/auth/logout"),
      { timeout: 15_000 },
    );
    await page.getByRole("button", { name: "Sign out" }).click();
    await logoutRequest;

    // After the reload, /api/auth/me is 401 so AuthGate renders the logged-out
    // OpenSignInScreen — distinguished from the signed-in create form by the
    // Sign up / Log in toggle, the workspace finder, and NO "Signed in as".
    await expect(toggle(page).filter({ hasText: "Sign up" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(toggle(page).filter({ hasText: "Log in" })).toBeVisible();
    await expect(page.getByText("Already have a workspace?")).toBeVisible();
    await expect(page.getByText("Signed in as")).toHaveCount(0);

    await ctx.close();
  });

  test("signing out from the tenant-locked Access Pending card returns to the logged-out sign-in card", async ({
    browser,
  }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await stubSignedInUntilLogout(page, LOCKED_CTX);
    // The logged-out tenant-locked SignInPanel fetches the tenant's published
    // brand by host; stub it so the card renders the tenant name without a DB
    // dependency.
    await page.route("**/api/lp/brand**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ brandName: "Acme Dental Co", logoUrl: null }),
      }),
    );
    await page.goto(APP_SHELL_URL, { waitUntil: "domcontentloaded" });

    // Start on the signed-in Access Pending invite card.
    await expect(
      page.getByRole("heading", { name: "Access Pending" }),
    ).toBeVisible({ timeout: 30_000 });

    // Clicking Sign out must POST /api/auth/logout, then reload.
    const logoutRequest = page.waitForRequest(
      (req) =>
        req.method() === "POST" && req.url().includes("/api/auth/logout"),
      { timeout: 15_000 },
    );
    await page.getByRole("button", { name: "Sign out" }).click();
    await logoutRequest;

    // After the reload, /api/auth/me is 401 so AuthGate renders the logged-out
    // tenant-locked SignInPanel: the tenant-scoped title + "Continue with
    // Google", and NO Access Pending card.
    await expect(
      page.getByRole("heading", { name: "Sign in to Acme Dental Co" }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByRole("button", { name: "Continue with Google" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Access Pending" }),
    ).toHaveCount(0);

    await ctx.close();
  });
});
