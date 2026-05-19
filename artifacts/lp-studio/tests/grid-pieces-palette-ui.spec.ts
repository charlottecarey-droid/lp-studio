// UI coverage for task #120 — Grid Pieces palette gating (task #122).
//
// The block-palette filtering logic lives in BuilderEditor.tsx and depends
// on the live AuthContext + the block-catalog fetch. The API spec sibling
// (grid-pieces-gating.spec.ts) verifies the server side; this spec asserts
// that the palette UI actually hides the "Grid Pieces" category for an
// editor without the `blocks` perm and shows it for an admin.
//
// We deliberately key off the category header text rendered in BlockLibrary
// (a small caps `<p>`) because that's the user-visible signal. If a
// refactor renames it, this test should fail loudly so the audit story
// stays accurate.

import { test, expect, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";
import pg from "pg";
import {
  createReviewWorkflowTenant,
  cleanupReviewWorkflowTenant,
  purgeStaleReviewWorkflowTenants,
  type ReviewWorkflowTenant,
} from "./setup/review-workflow-tenant";
import { purgeStaleRoyalTenants } from "./setup/royal-tenant";
import { csrfHeaders } from "./setup/csrf";

const dbUrl = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error("NEON_DATABASE_URL or DATABASE_URL is required for grid-pieces-palette-ui.spec.ts");
}
const pool = new pg.Pool({ connectionString: dbUrl, max: 4 });

let tenant: ReviewWorkflowTenant;

// The seeded `block_catalog` for industry='generic' intentionally ships with
// NO Grid Pieces rows — they're an admin-curated, gated category. To exercise
// the "admin sees Grid Pieces" path we need at least one row whose category
// matches what BlockLibrary groups on. We upsert a single neutral grid-piece
// (`grid-image`) for the duration of this spec and remove it after, so the
// global catalog isn't permanently mutated by tests.
const SEEDED_GRID_PIECE_TYPE = "grid-image";

test.beforeAll(async ({ request }) => {
  await purgeStaleReviewWorkflowTenants(pool);
  await purgeStaleRoyalTenants(pool);
  tenant = await createReviewWorkflowTenant(pool);

  await pool.query(
    `INSERT INTO block_catalog (block_type, industry, label, category, default_props, is_enabled, sort_order)
     VALUES ($1, 'generic', 'Image Tile', 'Grid Pieces', '{}'::jsonb, true, 0)
     ON CONFLICT (block_type, industry) DO UPDATE SET
       category = EXCLUDED.category, is_enabled = true`,
    [SEEDED_GRID_PIECE_TYPE],
  );

  // Drop the in-process tenant-by-host cache (mirrors the pattern used by
  // page-review-workflow-ui.spec.ts) so the freshly inserted tenant is the
  // one that the api-server resolves for host="localhost".
  await request.post("/api/_test/invalidate-host-cache").catch(() => undefined);
});

test.afterAll(async () => {
  await pool
    .query(`DELETE FROM block_catalog WHERE block_type = $1 AND industry = 'generic'`, [
      SEEDED_GRID_PIECE_TYPE,
    ])
    .catch(() => undefined);
  if (tenant) await cleanupReviewWorkflowTenant(pool, tenant);
  await pool.end();
});

async function setSessionCookie(context: BrowserContext, sid: string, baseURL: string): Promise<void> {
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

async function createDraftPage(request: APIRequestContext, sid: string, title: string): Promise<number> {
  const slug = `palette-${tenant.tenantId}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const res = await request.post("/api/lp/pages", {
    headers: { "Content-Type": "application/json", ...(await csrfHeaders(request, sid)) },
    data: { title, slug, blocks: [], status: "draft" },
  });
  if (res.status() !== 201) {
    throw new Error(`createDraftPage: HTTP ${res.status()} ${await res.text()}`);
  }
  return ((await res.json()) as { id: number }).id;
}

async function waitForBuilderReady(page: Page): Promise<void> {
  await page.waitForSelector('[data-testid="page-status-badge"]', { timeout: 60_000 });
}

async function openBlocksTab(page: Page): Promise<void> {
  // The Blocks tab is the default selection in BuilderEditor; clicking it
  // is still safe and idempotent. We use role+name to avoid coupling to
  // Radix's internal data-state attributes.
  const tab = page.getByRole("tab", { name: "Blocks", exact: true });
  if (await tab.count()) {
    await tab.first().click();
  }
}

// "Grid Pieces" lives in the Segment palette (SegmentLibrary), NOT the
// Blocks palette — BlockLibrary explicitly excludes "Grid Pieces" / "DSO"
// / "Showcase" to avoid duplicating them across both tabs. The tab is
// labeled "Segment" (singular — confirmed via the rendered ARIA tree).
// The audit story for task #122 is still about the same gate
// (`canUseGridPieces`), so we just open the right tab to read the
// category header.
async function openSegmentTab(page: Page): Promise<void> {
  const tab = page.getByRole("tab", { name: "Segment", exact: true });
  await expect(tab).toBeVisible({ timeout: 10_000 });
  await tab.first().click();
}

test.describe("Grid Pieces palette gating — BuilderEditor UI", () => {
  test("editor without `blocks` perm does NOT see the Grid Pieces category header", async ({ browser, baseURL, request }) => {
    expect(baseURL).toBeTruthy();
    const pageId = await createDraftPage(request, tenant.editor.sessionSid, "Editor palette test");

    const ctx = await browser.newContext();
    await setSessionCookie(ctx, tenant.editor.sessionSid, baseURL!);
    const page = await ctx.newPage();
    await page.goto(`/builder/${pageId}`, { waitUntil: "domcontentloaded" });
    await waitForBuilderReady(page);
    // Open the Blocks tab first (sanity — confirms the palette mounted),
    // then switch to the Segment tab which is where "Grid Pieces" would
    // appear if the gate regressed for the editor.
    await openBlocksTab(page);
    await expect(page.getByText("Layout", { exact: true }).first()).toBeVisible();
    await openSegmentTab(page);

    // The SegmentLibrary renders categories as small-caps <p> headings;
    // the exact-text match is the user-visible contract. If gating
    // regresses, this header reappears for the editor.
    await expect(page.getByText("Grid Pieces", { exact: true })).toHaveCount(0);

    await ctx.close();
  });

  test("admin (with `blocks`) DOES see the Grid Pieces category header", async ({ browser, baseURL, request }) => {
    expect(baseURL).toBeTruthy();
    const pageId = await createDraftPage(request, tenant.admin.sessionSid, "Admin palette test");

    const ctx = await browser.newContext();
    await setSessionCookie(ctx, tenant.admin.sessionSid, baseURL!);
    const page = await ctx.newPage();
    await page.goto(`/builder/${pageId}`, { waitUntil: "domcontentloaded" });
    await waitForBuilderReady(page);
    // Grid Pieces is rendered in the Segment tab (SegmentLibrary), not
    // the Blocks tab — see openSegmentTab() for why.
    await openSegmentTab(page);

    // The category header is rendered when at least one Grid Piece block
    // is in the catalog — which is always the case for the seeded tenant
    // (block-catalog defaults include the new tiles).
    await expect(page.getByText("Grid Pieces", { exact: true }).first()).toBeVisible({ timeout: 15_000 });

    await ctx.close();
  });
});
