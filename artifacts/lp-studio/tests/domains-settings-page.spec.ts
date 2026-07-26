// Settings → Domains page contract (settings consolidation Phase 3).
//
// Phase 3 turned the old single-purpose "Domain" tab into the one Domains
// page: landing-page domain (custom + managed cards, unchanged), workspace
// URL (login-URL/slug/redirect cards lifted from General), and an email
// "link, don't duplicate" card pointing at Settings → Email → Sending. This
// page previously had ZERO browser coverage; this spec pins the composition
// so a future settings shuffle can't silently drop a section.
//
// External dependencies are stubbed at the browser level: the custom-domain
// status endpoint (so no Cloudflare read runs) and the tenant-slug endpoint
// (so the slug card renders even when the e2e api-server has no
// WILDCARD_TENANT_BASE_HOSTS configured). Everything else hits the real API.

import pg from "pg";
import { test, expect, type BrowserContext } from "./setup/pw";
import {
  createRoyalTenant,
  cleanupRoyalTenant,
  purgeStaleRoyalTenants,
  type RoyalTenant,
} from "./setup/royal-tenant";
import { assertApiHealthy } from "./setup/api-health";

const { Pool } = pg;

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

test.describe("Settings → Domains page (Phase 3 composition)", () => {
  let pool: pg.Pool;
  let tenant: RoyalTenant;

  test.beforeAll(async () => {
    await assertApiHealthy();
    pool = new Pool({ connectionString: getDatabaseUrl(), max: 4 });
    await purgeStaleRoyalTenants(pool);
    tenant = await createRoyalTenant(pool);
  });

  test.afterAll(async () => {
    if (!pool) return;
    try {
      if (tenant) await cleanupRoyalTenant(pool, tenant);
    } finally {
      await pool.end().catch(() => undefined);
    }
  });

  test("shows all three domain sections and links out to Email → Sending", async ({
    browser,
    baseURL,
  }) => {
    expect(baseURL).toBeTruthy();
    const ctx = await browser.newContext();
    await setSessionCookie(ctx, tenant.sessionSid, baseURL!);

    // Managed-address state, no Cloudflare involved.
    await ctx.route("**/api/admin/custom-domain/status*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "cache-control": "no-store" },
        body: JSON.stringify({
          hostname: "royal-e2e.lpstudio.ai",
          cloudflareHostnameId: null,
          status: "active",
          sslStatus: "active",
          validationRecords: null,
          ownershipVerification: null,
          cnameTarget: "edge.lpstudio.ai",
          error: null,
          managed: true,
          customDomainAllowed: true,
        }),
      });
    });

    // Deterministic slug payload so the Workspace URL card renders regardless
    // of the e2e server's wildcard-host env.
    await ctx.route("**/api/admin/tenant-slug", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "cache-control": "no-store" },
        body: JSON.stringify({
          slug: "royal-e2e",
          domain: null,
          baseHost: "lpstudio.ai",
          canonicalHost: "royal-e2e.lpstudio.ai",
          loginUrl: "https://royal-e2e.lpstudio.ai",
          redirectTtlDays: 90,
        }),
      });
    });
    await ctx.route("**/api/admin/tenant-slug/redirects", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "cache-control": "no-store" },
        body: JSON.stringify({ currentSlug: "royal-e2e", baseHost: "lpstudio.ai", redirects: [] }),
      });
    });

    const page = await ctx.newPage();
    try {
      await page.goto("/settings/domain", { waitUntil: "domcontentloaded" });

      // The tab itself is relabeled "Domains".
      await expect(page.getByTestId("settings-tab-domain")).toHaveText(/Domains/, {
        timeout: 30_000,
      });
      await expect(page.getByRole("heading", { name: "Domains", exact: true })).toBeVisible();

      // Section 1: landing pages — managed-address editor from the stubbed state.
      await expect(page.getByRole("heading", { name: "Landing pages" })).toBeVisible();
      await expect(page.getByTestId("subdomain-input")).toBeVisible();

      // Section 2: workspace URL — the slug card lifted from General. The
      // section heading and the card's own heading share the name; assert the
      // section-level one (first in DOM order).
      await expect(page.getByRole("heading", { name: "Workspace URL", exact: true }).first()).toBeVisible();
      await expect(page.getByTestId("save-slug")).toBeVisible();

      // Section 3: email sending — link card, and it really navigates to the
      // Phase 1b home rather than duplicating the wizards here.
      await expect(page.getByRole("heading", { name: "Email sending", exact: true })).toBeVisible();
      const link = page.getByTestId("email-sending-domain-link");
      await expect(link).toBeVisible();
      await link.click();
      await expect(page).toHaveURL(/\/settings\/email\/sending/);
    } finally {
      await ctx.close();
    }
  });

  test("General settings no longer carries the workspace-URL cards", async ({
    browser,
    baseURL,
  }) => {
    const ctx = await browser.newContext();
    await setSessionCookie(ctx, tenant.sessionSid, baseURL!);
    const page = await ctx.newPage();
    try {
      await page.goto("/settings/general", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "General settings" })).toBeVisible({
        timeout: 30_000,
      });
      // The toggles stayed…
      await expect(page.getByTestId("require-review-toggle")).toBeVisible();
      // …the slug editor moved to Domains.
      await expect(page.getByTestId("save-slug")).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "Workspace login URL" })).toHaveCount(0);
    } finally {
      await ctx.close();
    }
  });
});
