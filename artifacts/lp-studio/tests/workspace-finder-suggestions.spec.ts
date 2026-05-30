/**
 * Task #519 — End-to-end coverage for the workspace finder's typo-tolerant
 * "Did you mean" suggestions on the central (open-domain) auth gate.
 *
 * The fuzzy-suggestion logic itself is covered by the in-process API test
 * (auth.findWorkspace.integration.test.ts), and the finder's happy path +
 * not-found state are covered by open-login-workspace-finder.spec.ts (task
 * #498). What had NO end-to-end coverage was the suggestion branch through the
 * real WorkspaceFinder UI: typing a near-miss of a real company name, seeing
 * the clickable "Did you mean" list render with the correct workspace name +
 * canonical host, and confirming the link actually navigates to that
 * workspace's URL.
 *
 * This spec drives the REAL UI against the REAL `/api/auth/find-workspace`
 * endpoint (only /api/auth/me + /api/auth/domain-context are stubbed so the
 * AuthGate renders the logged-out open screen deterministically). It seeds and
 * tears down its own tenant fixture.
 *
 * Approach mirrors open-login-workspace-finder.spec.ts:
 *  - The tenant is seeded with a unique custom domain so the server-computed
 *    canonical host is deterministic (getCanonicalTenantHost prefers
 *    tenants.domain over <slug>.lpstudio.ai) AND distinct from the request
 *    host (127.0.0.1) so the finder stays enabled (it 404s when the request
 *    host itself resolves to a tenant).
 *  - The unique random suffix in the tenant name guarantees our seeded tenant
 *    is the ONLY workspace close enough to clear the suggestion threshold for
 *    our typo'd query, so the asserted suggestion is unambiguous.
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
// sign-in screen + workspace finder) only exists inside the SaaS shell.
const APP_SHELL_URL = `${APP}/?preview=app`;

const dbUrl = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error(
    "NEON_DATABASE_URL or DATABASE_URL is required for workspace-finder-suggestions.spec.ts",
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

/**
 * Stub the two endpoints AuthGate's render decision depends on:
 *   - /api/auth/me             → 401 (logged out)
 *   - /api/auth/domain-context → the open-domain payload
 * Everything else (incl. /api/auth/find-workspace) passes through to the real
 * api-server booted by the Playwright webServer config.
 */
async function stubLoggedOutOpen(page: Page): Promise<void> {
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
      body: JSON.stringify(OPEN_CTX),
    }),
  );
}

test.afterAll(async () => {
  await pool.end().catch(() => undefined);
});

test.describe("Workspace finder — typo suggestions (task #519)", () => {
  let tenant: RoyalTenant;
  // Custom domain so the canonical host is deterministic AND distinct from the
  // request host (127.0.0.1), keeping the finder enabled.
  let targetHost: string;
  // The exact display name of the seeded tenant — the finder must surface this
  // verbatim in the suggestion. createRoyalTenant names the tenant
  // `Royal Test Tenant <suffix>`.
  let tenantName: string;

  test.beforeAll(async ({ request }) => {
    await purgeStaleRoyalTenants(pool);
    const suffix = `finder-sugg-${randomBytes(4).toString("hex")}`;
    targetHost = `${suffix}.example.com`;
    tenant = await createRoyalTenant(pool, {
      uniqueSuffix: suffix,
      domain: targetHost,
      // The fixture default plan="trial" is rejected by the tenants
      // plan-canonical check constraint; pass a canonical tier explicitly.
      plan: "growth",
    });
    tenantName = `Royal Test Tenant ${suffix}`;
    // The finder's host-resolution check reads the in-process tenant cache;
    // drop it so the freshly seeded tenant is visible immediately.
    await request.post("/api/_test/invalidate-host-cache").catch(() => undefined);
  });

  test.afterAll(async () => {
    if (tenant) await cleanupRoyalTenant(pool, tenant).catch(() => undefined);
  });

  test("a near-miss company name surfaces a clickable suggestion that navigates to the workspace", async ({
    browser,
  }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await stubLoggedOutOpen(page);
    // Intercept the cross-origin suggestion target so the click assertion
    // doesn't depend on a real DNS resolution of the example.com host.
    await page.route(`https://${targetHost}/**`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<html><body>Workspace login</body></html>",
      }),
    );
    await page.goto(APP_SHELL_URL, { waitUntil: "domcontentloaded" });

    const input = page.getByLabel("Company name or workspace");
    await expect(input).toBeVisible({ timeout: 30_000 });

    // Type a near-miss of the real company name: a single-character typo
    // ("Tenant" → "Tenent"). This misses the exact slug/name lookup but clears
    // the fuzzy similarity floor, so the endpoint returns it as a suggestion.
    const typo = tenantName.replace("Tenant", "Tenent");
    await input.fill(typo);
    await page.getByRole("button", { name: "Find" }).click();

    // The "Did you mean" list renders with the correct workspace name + host.
    await expect(page.getByText("Did you mean:")).toBeVisible({ timeout: 15_000 });
    const suggestion = page.getByRole("link", { name: new RegExp(tenantName, "i") });
    await expect(suggestion).toBeVisible();
    await expect(suggestion).toContainText(tenantName);
    await expect(suggestion).toContainText(targetHost);
    // The link must point at the workspace's canonical URL.
    await expect(suggestion).toHaveAttribute("href", `https://${targetHost}`);

    // Clicking the suggestion navigates the browser to the workspace URL.
    await suggestion.click();
    await page.waitForURL(`https://${targetHost}/`, { timeout: 15_000 });
    expect(page.url()).toBe(`https://${targetHost}/`);

    await ctx.close();
  });
});
