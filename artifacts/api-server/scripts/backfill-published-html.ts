/**
 * One-time + on-demand backfill: render-and-store every currently
 * published landing page into R2 (and Replit OS as the debug-only cache).
 *
 * Usage (from artifacts/api-server/):
 *   pnpm tsx scripts/backfill-published-html.ts                # all tenants
 *   pnpm tsx scripts/backfill-published-html.ts --tenant=42    # one tenant
 *   pnpm tsx scripts/backfill-published-html.ts --slug=foo --tenant=42
 *   pnpm tsx scripts/backfill-published-html.ts --only-missing # skip pages
 *                                                              # already in R2
 *
 * Telemetry: prints per-page JSON `{pageId, slug, tenantId, outcome,
 * durationMs, error?}` to stdout, then a summary `{succeeded, r2Failed,
 * osFailedBenign, renderFailed, skipped, totalDurationMs}`.
 *
 * Exits non-zero if ANY page failed at R2 (the only failure mode that
 * leaves the visitor cache stale). OS-benign failures and render-failed
 * pages exit zero — the script can be re-run after fixing the underlying
 * cause without polluting CI signal.
 *
 * Concurrency: serial by default. Use `--concurrency=N` to parallelize.
 * Default-serial because Playwright (used by prerenderLpPage) is memory-
 * heavy and we'd rather not OOM the migration container.
 *
 * Task #364.
 */
import { db, lpPagesTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { renderAndStoreNow } from "../src/lib/triggerPublishedRender";
import { publishedHtmlExistsInR2, isR2Configured } from "../src/lib/r2Storage";

interface Args {
  tenantId?: number;
  slug?: string;
  onlyMissing?: boolean;
  concurrency: number;
}

function parseArgs(argv: string[]): Args {
  const out: Args = { concurrency: 1 };
  for (const a of argv.slice(2)) {
    if (a.startsWith("--tenant=")) out.tenantId = Number(a.slice("--tenant=".length));
    else if (a.startsWith("--slug=")) out.slug = a.slice("--slug=".length);
    else if (a === "--only-missing") out.onlyMissing = true;
    else if (a.startsWith("--concurrency=")) out.concurrency = Math.max(1, Number(a.slice("--concurrency=".length)));
  }
  return out;
}

interface PerPageLog {
  pageId: number;
  tenantId: number;
  slug: string;
  outcome:
    | "succeeded"
    | "r2_write_failed"
    | "os_write_failed_benign"
    | "render_failed"
    | "skipped_not_published"
    | "skipped_already_in_r2"
    | "superseded_by_concurrent_edit";
  durationMs: number;
  error?: string;
}

async function processPage(page: { id: number; tenantId: number; slug: string }, onlyMissing: boolean): Promise<PerPageLog> {
  const t0 = Date.now();
  if (onlyMissing && isR2Configured()) {
    try {
      const exists = await publishedHtmlExistsInR2(page.tenantId, page.slug);
      if (exists) {
        return { pageId: page.id, tenantId: page.tenantId, slug: page.slug, outcome: "skipped_already_in_r2", durationMs: Date.now() - t0 };
      }
    } catch {
      /* fall through and attempt render */
    }
  }
  // Don't try to look up a per-tenant host — the trigger falls back to
  // LP_STUDIO_PUBLIC_HOST / REPLIT_DEV_DOMAIN, which yields a sane
  // canonical URL even when run from a CLI context with no request.
  const result = await renderAndStoreNow({ pageId: page.id, requestHost: null });
  if (result.r2Ok && result.osOk) {
    return { pageId: page.id, tenantId: page.tenantId, slug: page.slug, outcome: "succeeded", durationMs: result.durationMs };
  }
  if (result.skipped === "r2_write_failed") {
    return { pageId: page.id, tenantId: page.tenantId, slug: page.slug, outcome: "r2_write_failed", durationMs: result.durationMs, error: result.error };
  }
  if (result.skipped === "render_failed") {
    return { pageId: page.id, tenantId: page.tenantId, slug: page.slug, outcome: "render_failed", durationMs: result.durationMs, error: result.error };
  }
  if (result.skipped === "not_published" || result.skipped === "page_not_found") {
    return { pageId: page.id, tenantId: page.tenantId, slug: page.slug, outcome: "skipped_not_published", durationMs: result.durationMs };
  }
  if (result.skipped === "superseded_by_concurrent_edit") {
    return { pageId: page.id, tenantId: page.tenantId, slug: page.slug, outcome: "superseded_by_concurrent_edit", durationMs: result.durationMs };
  }
  // R2 ok, OS failed
  return { pageId: page.id, tenantId: page.tenantId, slug: page.slug, outcome: "os_write_failed_benign", durationMs: result.durationMs };
}

async function main() {
  const args = parseArgs(process.argv);
  if (!isR2Configured()) {
    console.warn("[backfill] R2 not configured. Will write to Replit OS only and treat R2 as no-op.");
  }

  const whereClauses = [eq(lpPagesTable.status, "published")];
  if (args.tenantId !== undefined) whereClauses.push(eq(lpPagesTable.tenantId, args.tenantId));
  if (args.slug !== undefined) whereClauses.push(eq(lpPagesTable.slug, args.slug));

  const pages = await db
    .select({ id: lpPagesTable.id, tenantId: lpPagesTable.tenantId, slug: lpPagesTable.slug })
    .from(lpPagesTable)
    .where(and(...whereClauses));

  console.log(`[backfill] ${pages.length} candidate pages`);
  const t0 = Date.now();
  const results: PerPageLog[] = [];

  // Serial loop is fine even at N=1; parallelize only when --concurrency>1.
  if (args.concurrency <= 1) {
    for (const page of pages) {
      const r = await processPage(page, args.onlyMissing ?? false);
      console.log(JSON.stringify(r));
      results.push(r);
    }
  } else {
    const queue = [...pages];
    const workers: Promise<void>[] = [];
    for (let i = 0; i < args.concurrency; i++) {
      workers.push((async () => {
        while (queue.length > 0) {
          const page = queue.shift();
          if (!page) return;
          const r = await processPage(page, args.onlyMissing ?? false);
          console.log(JSON.stringify(r));
          results.push(r);
        }
      })());
    }
    await Promise.all(workers);
  }

  const summary = {
    total: results.length,
    succeeded: results.filter((r) => r.outcome === "succeeded").length,
    skipped_already_in_r2: results.filter((r) => r.outcome === "skipped_already_in_r2").length,
    skipped_not_published: results.filter((r) => r.outcome === "skipped_not_published").length,
    superseded_by_concurrent_edit: results.filter((r) => r.outcome === "superseded_by_concurrent_edit").length,
    r2_write_failed: results.filter((r) => r.outcome === "r2_write_failed").length,
    os_write_failed_benign: results.filter((r) => r.outcome === "os_write_failed_benign").length,
    render_failed: results.filter((r) => r.outcome === "render_failed").length,
    totalDurationMs: Date.now() - t0,
  };
  console.log("[backfill] summary", JSON.stringify(summary, null, 2));

  // Exit non-zero ONLY when something left R2 stale; OS-benign and
  // render failures are exit-zero (re-runnable).
  process.exit(summary.r2_write_failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("[backfill] fatal", err);
  process.exit(2);
});
