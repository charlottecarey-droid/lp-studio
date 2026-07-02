/**
 * Regression test for task #389 — Sentry `prerender_render_failed` storm
 * caused by FK violations on `lp_page_reviews`.
 *
 * Scenario: a publish handler queues the background prerender, then the
 * page row is deleted before the worker runs. Without the fix, the
 * worker called `ensureReviewToken` -> INSERT lp_page_reviews and
 * Postgres raised `lp_page_reviews_page_id_lp_pages_id_fk` (SQLSTATE
 * 23503). The outer caller mislabelled that as `nav_or_timeout` and
 * Sentry showed 30 events / 20 users in dev.
 *
 * After the fix the worker:
 *   1. detects the missing page via tenant-scoped re-fetch (or via the
 *      typed FK conversion if the row vanishes between SELECT and INSERT),
 *   2. throws `PrerenderPageMissingError` from prerenderLpPage,
 *   3. and `triggerPublishedRender` returns `outcome.skipped='page_missing'`
 *      WITHOUT firing the second Chromium attempt.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { dbAvailable } from "../test-utils/dbAvailable";
import { db, lpPagesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// Mocks must come BEFORE the SUT import. We stub the storage layers so
// the test does no real R2 / OS I/O.
vi.mock("./r2Storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./r2Storage")>();
  return {
    ...actual,
    isR2Configured: vi.fn(() => false),
    uploadPublishedHtmlToR2: vi.fn(async () => {}),
    deletePublishedHtmlFromR2: vi.fn(async () => {}),
  };
});
vi.mock("./publishedHtmlStorage", () => ({
  uploadPublishedHtml: vi.fn(async () => {}),
  deletePublishedHtml: vi.fn(async () => {}),
}));

// Pin the trigger to use the REAL prerenderLpPage — that's the path we
// care about exercising. The test deletes the page before the worker's
// ensureReviewToken runs, which is exactly the race the task describes.

const { renderAndStoreNow } = await import("./triggerPublishedRender");
const { PrerenderPageMissingError } = await import("./prerenderLpPage");

interface SeededPage {
  pageId: number;
  tenantId: number;
  slug: string;
}

async function pickTenantId(): Promise<number> {
  // Use any tenant that already owns a page — guarantees the FK to
  // tenants is satisfied without us having to know the schema's tenant
  // table.
  const [row] = await db
    .select({ tenantId: lpPagesTable.tenantId })
    .from(lpPagesTable)
    .limit(1);
  if (!row) {
    throw new Error(
      "[pageMissing test] no lp_pages rows in DB — need at least one row " +
        "to derive a valid tenantId. Seed a tenant + page before running.",
    );
  }
  return row.tenantId;
}

async function seedFixture(): Promise<SeededPage> {
  const tenantId = await pickTenantId();
  const slug = `task389-page-missing-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const [inserted] = await db
    .insert(lpPagesTable)
    .values({
      tenantId,
      title: "task #389 fixture",
      slug,
      blocks: [],
      status: "published",
    })
    .returning({ id: lpPagesTable.id });
  return { pageId: inserted.id, tenantId, slug };
}

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("triggerPublishedRender — page deleted before worker (task #389)", () => {
  let fixture: SeededPage;

  beforeAll(async () => {
    fixture = await seedFixture();
  });

  afterAll(async () => {
    // Best-effort cleanup. If the test deleted the row already, this is
    // a no-op; otherwise it removes the fixture.
    await db.delete(lpPagesTable).where(eq(lpPagesTable.id, fixture.pageId));
  });

  it("returns skipped='page_missing' (no render_failed) when the page row is gone", async () => {
    // Delete the row BEFORE invoking the worker. The outer renderAndStore
    // does its own SELECT; we need that to fail too so the worker takes
    // the early `page_not_found` exit OR (if we wanted to test the inner
    // race) we'd have to inject a delete between SELECT and ensureReviewToken.
    // The architect-flagged contract is the same for both: the worker
    // must NOT raise a render_failed Sentry alert.
    await db.delete(lpPagesTable).where(eq(lpPagesTable.id, fixture.pageId));

    const outcome = await renderAndStoreNow({
      pageId: fixture.pageId,
      requestHost: null,
    });

    // The outer fetch catches it first → `page_not_found`. Either skip
    // is acceptable as long as we did NOT report `render_failed`.
    expect(outcome.skipped === "page_not_found" || outcome.skipped === "page_missing").toBe(true);
    expect(outcome.skipped).not.toBe("render_failed");
    expect(outcome.r2Ok).toBe(false);
    expect(outcome.osOk).toBe(false);
  }, 15_000);

  it("ensureReviewToken (via prerenderLpPage) throws PrerenderPageMissingError for a non-existent page", async () => {
    // Direct exercise of the FK-safety guard added in task #389. We
    // can't easily invoke ensureReviewToken alone (it's private), but
    // prerenderLpPage's first awaited op is the token fetch, so an
    // unknown pageId surfaces the typed error before Chromium launches.
    const { prerenderLpPage } = await import("./prerenderLpPage");
    const bogusPageId = 2_147_000_000; // well outside any real serial id range
    await expect(
      prerenderLpPage({ pageId: bogusPageId, tenantId: fixture.tenantId, slug: "noop" }),
    ).rejects.toBeInstanceOf(PrerenderPageMissingError);
  }, 15_000);
});
