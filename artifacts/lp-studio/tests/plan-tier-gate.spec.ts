// Plan-tier gate end-to-end check (task #400).
//
// Mirrors the server-side `requirePlanFeature("salesConsole")` gate from the
// browser's perspective. For a starter-plan tenant the SaaS shell must:
//   - collapse the mode toggle to a Marketing-only pill (no Sales segment)
//   - bounce /sales/* navigation back to the workspace root
//
// For a Dandy operator (app_users.role = 'superadmin') the shell must
// behave exactly the opposite, even when the active tenant is on starter:
//   - render the full Marketing / Sales toggle
//   - allow /sales to load (no client-side redirect)
//
// Together with `src/middleware/requirePlanFeature.test.ts` on the server
// side, this covers both halves of the packaging boundary.

import pg from "pg";
import { test, expect, type BrowserContext } from "./setup/pw";
import {
  createRoyalTenant,
  cleanupRoyalTenant,
  purgeStaleRoyalTenants,
  type RoyalTenant,
} from "./setup/royal-tenant";

const { Pool } = pg;

function getDatabaseUrl(): string {
  const url = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "NEON_DATABASE_URL / DATABASE_URL must be set so the tenant fixture can " +
        "create a fresh tenant in the dev DB.",
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

test.describe("Plan-tier gate (starter)", () => {
  let pool: pg.Pool;
  let tenant: RoyalTenant;

  test.beforeAll(async ({ request }) => {
    pool = new Pool({ connectionString: getDatabaseUrl(), max: 4 });
    await purgeStaleRoyalTenants(pool);
    tenant = await createRoyalTenant(pool, { plan: "starter" });
    await request.post("/api/_test/invalidate-host-cache").catch(() => undefined);
  });

  test.afterAll(async () => {
    if (tenant && pool) await cleanupRoyalTenant(pool, tenant);
    if (pool) await pool.end();
  });

  test("renders Marketing-only mode pill and redirects /sales back to /", async ({
    page,
    context,
    baseURL,
  }) => {
    await setSessionCookie(context, tenant.sessionSid, baseURL!);

    // 1. Mode toggle should collapse to Marketing-only — no Sales segment.
    //    `?preview=app` forces the SaaS shell in dev mode — without it,
    //    `/` resolves to the public marketing site (App.tsx isMarketingHost
    //    treats "/" as a marketing path in dev).
    await page.goto("/?preview=app");
    const marketing = page.getByRole("button", { name: /^Marketing$/ });
    await expect(marketing).toBeVisible();
    await expect(page.getByRole("button", { name: /^Sales$/ })).toHaveCount(0);

    // 2. Direct nav to /sales must render the friendly UpgradePrompt
    //    instead of the Sales tree. Task #398 replaced the old silent
    //    redirect with an explainer card so starter users see *why*
    //    Sales is locked and how to unlock it — the URL stays on /sales
    //    but the page body is the upgrade prompt, not the Sales console.
    //    The server-side `requirePlanFeature("salesConsole")` middleware
    //    is still the real security boundary (any /api/sales/* call from
    //    this view 402s); this assertion just pins the client UX.
    await page.goto("/sales", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /Sales Console is a Growth feature/i }),
    ).toBeVisible();
  });
});

test.describe("Plan-tier gate (superadmin in starter tenant)", () => {
  let pool: pg.Pool;
  let tenant: RoyalTenant;

  test.beforeAll(async ({ request }) => {
    pool = new Pool({ connectionString: getDatabaseUrl(), max: 4 });
    await purgeStaleRoyalTenants(pool);
    tenant = await createRoyalTenant(pool, {
      plan: "starter",
      appUserRole: "superadmin",
    });
    await request.post("/api/_test/invalidate-host-cache").catch(() => undefined);
  });

  test.afterAll(async () => {
    if (tenant && pool) await cleanupRoyalTenant(pool, tenant);
    if (pool) await pool.end();
  });

  test("shows the full Marketing/Sales toggle and allows /sales to load", async ({
    page,
    context,
    baseURL,
  }) => {
    await setSessionCookie(context, tenant.sessionSid, baseURL!);

    // 1. Toggle should render BOTH segments — superadmin bypass mirrors
    //    the server-side bypass in requirePlanFeature. `?preview=app` forces
    //    the SaaS shell in dev (see starter test above).
    await page.goto("/?preview=app");
    await expect(page.getByRole("button", { name: /^Marketing$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Sales$/ })).toBeVisible();

    // 2. /sales must load (no redirect back to /) — the AppShell
    //    redirect is skipped for superadmins.
    await page.goto("/sales", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/sales(\/|$|\?)/);
  });
});
