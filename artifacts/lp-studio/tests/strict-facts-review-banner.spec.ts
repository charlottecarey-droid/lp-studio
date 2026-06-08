// Task #1296 — End-to-end coverage for the Strict Facts review banner appearing
// on builder load (the #1295 race fix).
//
// Background
// ──────────
// Task #1295 fixed a timing race: the page-creation handoff fires a best-effort
// fact-flags sync before navigating to the builder, but the builder's one-shot
// GET on mount usually won that race and read pendingCount=0, so the "facts on
// this page need review" banner never appeared. The fix re-runs the idempotent,
// regen-memory-aware sync once per page load inside BuilderEditor (see the
// `factSyncedRef` effect) as the source of truth, then refreshes the flags off
// the result.
//
// These specs lock that behaviour in through the REAL React app:
//   1. A page seeded with unapproved stats + a quote (NO flags pre-synced) shows
//      the banner after the builder opens — WITHOUT any manual refresh. If the
//      on-load sync regresses, no rows are ever created and the banner is absent.
//   2. A page with no detectable facts shows NO banner after the on-load sync.
//   3. A page whose facts were all resolved (bulk-approved) stays resolved across
//      a hard reload — the on-load sync re-detects the same facts but honours
//      regen memory and never resurrects them back to pending.
//
// The neutral Royal fixture has no approved proof points, so any stat/quote in a
// seeded page is unapproved and therefore flaggable. The banner is driven purely
// by `factFlags.pendingCount > 0`, independent of the Strict Facts toggle, so we
// don't need to flip any brand setting.

import { test, expect, type APIRequestContext, type BrowserContext, type Page } from "./setup/pw";
import pg from "pg";
import { randomBytes } from "node:crypto";
import {
  createRoyalTenant,
  cleanupRoyalTenant,
  purgeStaleRoyalTenants,
  type RoyalTenant,
} from "./setup/royal-tenant";
import { csrfHeaders } from "./setup/csrf";

const dbUrl = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error(
    "NEON_DATABASE_URL or DATABASE_URL is required for strict-facts-review-banner.spec.ts",
  );
}
const pool = new pg.Pool({ connectionString: dbUrl, max: 4 });

let tenant: RoyalTenant;

// Blocks carrying unapproved facts: a stat in the hero headline, two trust-bar
// stats, and an attributed testimonial quote. None of these exist in the neutral
// fixture's (empty) approved-fact pool, so all become pending flags.
const WITH_FACTS_BLOCKS = [
  { id: "hero", type: "hero", props: { headline: "We deliver 2.5x ROI", subhead: "Faster turnarounds for every case." } },
  { id: "tb", type: "trust-bar", props: { items: [{ value: "47%", label: "faster" }, { value: "98%", label: "fit" }] } },
  { id: "tm", type: "testimonial", props: { quote: "Best decision our practice ever made.", author: "Dr. Lopez", company: "Smile Co." } },
];

// Blocks with NO detectable facts — no digits/units (stat), no claim trigger
// phrases, and no quote-bearing block. The on-load sync must create zero flags.
const CLEAN_BLOCKS = [
  { id: "hero", type: "hero", props: { headline: "Grow your practice with confidence", subhead: "Modern restorations crafted with care for every smile." } },
  { id: "cta", type: "cta", props: { headline: "Ready to get started?", buttonText: "Contact us" } },
];

test.beforeAll(async ({ request }) => {
  // Purge stale Royal tenants from any prior crashed run so the api-server's
  // host→tenant cache resolves `localhost` deterministically to our fixture.
  await purgeStaleRoyalTenants(pool);
  tenant = await createRoyalTenant(pool, {
    uniqueSuffix: `facts-banner-${Date.now().toString(36)}`,
  });
  // Drop the in-process tenant-by-host cache so the freshly inserted tenant is
  // resolved for host="localhost" without waiting out the 60s TTL.
  await request.post("/api/_test/invalidate-host-cache").catch(() => undefined);
});

test.afterAll(async () => {
  if (tenant) await cleanupRoyalTenant(pool, tenant);
  await pool.end();
});

/** Seed a draft page directly in the dev DB and return its id. */
async function seedPage(blocks: unknown[]): Promise<number> {
  const suffix = `${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
  const res = await pool.query<{ id: number }>(
    `INSERT INTO lp_pages (tenant_id, title, slug, status, blocks)
     VALUES ($1, $2, $3, 'draft', $4::jsonb) RETURNING id`,
    [tenant.tenantId, `Facts Banner ${suffix}`, `facts-banner-${suffix}`, JSON.stringify(blocks)],
  );
  return res.rows[0].id;
}

/**
 * Attach the api-server's lp_sid session cookie to a browser context so the
 * /api/auth/me call inside AuthProvider rehydrates the right user.
 */
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

/** Wait until BuilderEditor has finished its initial load. */
async function waitForEditorReady(page: Page): Promise<void> {
  try {
    await page.waitForSelector('[data-testid="page-status-badge"]', { timeout: 60_000 });
  } catch (err) {
    const url = page.url();
    let title = "";
    let bodyText = "";
    try {
      title = await page.title();
      bodyText = (await page.locator("body").innerText({ timeout: 2_000 })).slice(0, 1200);
    } catch {
      /* fall through */
    }
    throw new Error(
      `Timed out waiting for builder status badge.\n` +
        `URL: ${url}\nTitle: ${JSON.stringify(title)}\nBody snapshot:\n${bodyText}\n` +
        `Original error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** Promise that resolves when the builder's on-load fact-flags sync POST lands. */
function waitForOnLoadSync(page: Page, pageId: number): Promise<unknown> {
  return page.waitForResponse(
    (r) =>
      r.request().method() === "POST" &&
      r.url().includes(`/lp/pages/${pageId}/fact-flags/sync`),
    { timeout: 30_000 },
  );
}

async function openBuilder(
  browser: import("./setup/pw").Browser,
  baseURL: string,
  pageId: number,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  await setSessionCookie(context, tenant.sessionSid, baseURL);
  const page = await context.newPage();
  return { context, page };
}

test.describe("Strict Facts review banner on builder load (task #1296)", () => {
  test("banner appears for a page with unapproved facts WITHOUT a manual refresh", async ({ browser, baseURL }) => {
    expect(baseURL, "playwright baseURL must be configured").toBeTruthy();
    const pageId = await seedPage(WITH_FACTS_BLOCKS);

    const { context, page } = await openBuilder(browser, baseURL!, pageId);
    try {
      // The page is seeded WITHOUT any pre-synced flags, so the only thing that
      // can create them — and therefore the banner — is the builder's on-load
      // sync. This is exactly the #1295 fix.
      await page.goto(`/builder/${pageId}`, { waitUntil: "domcontentloaded" });
      await waitForEditorReady(page);

      const banner = page.locator('[data-testid="fact-review-banner"]');
      await expect(banner).toBeVisible({ timeout: 30_000 });
      await expect(banner).toContainText(/facts? on this page needs? review/i);
      // The "Review facts" affordance opens the review modal.
      await expect(banner.getByRole("button", { name: /Review facts/i })).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("no banner appears for a page with no detectable facts", async ({ browser, baseURL }) => {
    expect(baseURL, "playwright baseURL must be configured").toBeTruthy();
    const pageId = await seedPage(CLEAN_BLOCKS);

    const { context, page } = await openBuilder(browser, baseURL!, pageId);
    try {
      const syncDone = waitForOnLoadSync(page, pageId);
      await page.goto(`/builder/${pageId}`, { waitUntil: "domcontentloaded" });
      await waitForEditorReady(page);
      // Wait for the on-load sync to actually run, so a missing banner means
      // "the sync found nothing", not "the sync hasn't fired yet".
      await syncDone;

      await expect(page.locator('[data-testid="fact-review-banner"]')).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test("resolved (bulk-approved) facts stay resolved across a reload — on-load sync never resurrects them", async ({ browser, baseURL, request }) => {
    expect(baseURL, "playwright baseURL must be configured").toBeTruthy();
    const pageId = await seedPage(WITH_FACTS_BLOCKS);

    // Sync once via the API to create the pending flags, then bulk-approve them
    // all (the reviewer "approve all" action). The page now has only resolved
    // (approved_for_page) flags.
    const headers = await csrfHeaders(request, tenant.sessionSid);
    const syncRes = await request.post(`/api/lp/pages/${pageId}/fact-flags/sync`, {
      headers: { "Content-Type": "application/json", ...headers },
      data: {},
    });
    expect(syncRes.status(), `sync (HTTP ${syncRes.status()}: ${await syncRes.text()})`).toBe(200);
    expect((await syncRes.json()).pendingCount).toBeGreaterThan(0);

    const approveRes = await request.post(`/api/lp/pages/${pageId}/fact-flags/bulk-approve`, {
      headers: { "Content-Type": "application/json", ...headers },
      data: {},
    });
    expect(approveRes.status()).toBe(200);

    const { context, page } = await openBuilder(browser, baseURL!, pageId);
    try {
      // First load: the on-load sync re-detects the same facts but must honour
      // the prior approvals (regen memory) and NOT re-create pending flags.
      const sync1 = waitForOnLoadSync(page, pageId);
      await page.goto(`/builder/${pageId}`, { waitUntil: "domcontentloaded" });
      await waitForEditorReady(page);
      await sync1;
      await expect(page.locator('[data-testid="fact-review-banner"]')).toHaveCount(0);

      // Hard reload: the same regen-memory guarantee must hold.
      const sync2 = waitForOnLoadSync(page, pageId);
      await page.reload({ waitUntil: "domcontentloaded" });
      await waitForEditorReady(page);
      await sync2;
      await expect(page.locator('[data-testid="fact-review-banner"]')).toHaveCount(0);
    } finally {
      await context.close();
    }

    // Server truth: the flags are still resolved, none resurrected to pending.
    const listRes = await request.get(`/api/lp/pages/${pageId}/fact-flags`, {
      headers: { Cookie: `lp_sid=${tenant.sessionSid}` },
    });
    expect(listRes.status()).toBe(200);
    const list = (await listRes.json()) as {
      pendingCount: number;
      flags: { triageState: string }[];
    };
    expect(list.pendingCount).toBe(0);
    expect(list.flags.length).toBeGreaterThan(0);
    for (const f of list.flags) {
      expect(f.triageState).toBe("approved_for_page");
    }
  });
});
