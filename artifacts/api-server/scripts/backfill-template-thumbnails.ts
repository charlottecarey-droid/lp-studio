/**
 * One-time + on-demand backfill: capture a real screenshot thumbnail for every
 * template (an `lp_pages` row with is_template = true) that doesn't already
 * have one, and store the thum.io URL on `lp_pages.thumbnail_url`.
 *
 * Task #736.
 *
 * Usage (from artifacts/api-server/):
 *   pnpm tsx scripts/backfill-template-thumbnails.ts                  # all templates w/o a thumbnail
 *   pnpm tsx scripts/backfill-template-thumbnails.ts --all           # re-capture even already-set ones
 *   pnpm tsx scripts/backfill-template-thumbnails.ts --tenant=42     # one tenant's templates
 *   pnpm tsx scripts/backfill-template-thumbnails.ts --concurrency=5
 *   pnpm tsx scripts/backfill-template-thumbnails.ts --limit=20 --offset=0
 *
 * ⚠️  PRODUCTION DATA: the workspace `@workspace/db` connection points at the
 * production Neon database. This script WRITES `thumbnail_url` to real template
 * rows and makes outbound thum.io calls that fetch the public /preview render.
 * Run it deliberately and confirm the target before launching.
 *
 * Host: thum.io must be able to reach the /preview/:slug render. Set
 * LP_STUDIO_RENDER_BASE_URL (or rely on REPLIT_DEV_DOMAIN in dev). The capture
 * helper resolves the base URL the same way; no requestHost is available here.
 *
 * Telemetry: prints per-template JSON `{pageId, slug, tenantId, outcome,
 * durationMs, error?}` to stdout, then a summary. Failures leave thumbnail_url
 * NULL so the template is retried on the next run (re-runnable, exit 0 unless a
 * fatal error). Placeholder/scaffold templates (e.g. "_____ One Pager") are
 * skipped so we never capture junk.
 */
import { db, lpPagesTable } from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";
import { captureTemplateThumbnail } from "../src/lib/captureTemplateThumbnail";

interface Args {
  tenantId?: number;
  all: boolean;
  concurrency: number;
  limit?: number;
  offset?: number;
}

function parseArgs(argv: string[]): Args {
  const out: Args = { all: false, concurrency: 3 };
  for (const a of argv.slice(2)) {
    if (a.startsWith("--tenant=")) out.tenantId = Number(a.slice("--tenant=".length));
    else if (a === "--all") out.all = true;
    else if (a.startsWith("--concurrency=")) out.concurrency = Math.max(1, Number(a.slice("--concurrency=".length)));
    else if (a.startsWith("--limit=")) out.limit = Math.max(1, Number(a.slice("--limit=".length)));
    else if (a.startsWith("--offset=")) out.offset = Math.max(0, Number(a.slice("--offset=".length)));
  }
  return out;
}

/** Mirror of routes/lp/templates.ts::isPlaceholderTemplateLabel — keep in sync.
 * Scaffold/blank-fill template names that should never get a captured thumbnail. */
function isPlaceholderTemplateLabel(label: string | null | undefined): boolean {
  const l = (label ?? "").trim();
  if (!l) return true;
  if (/_{3,}/.test(l)) return true;
  if (/^_+\s/.test(l)) return true;
  return false;
}

type Outcome = "succeeded" | "failed" | "skipped_placeholder" | "skipped_no_slug";

interface PerTemplateLog {
  pageId: number;
  tenantId: number;
  slug: string;
  label: string;
  outcome: Outcome;
  durationMs: number;
  error?: string;
}

async function processTemplate(t: {
  id: number;
  tenantId: number;
  slug: string | null;
  templateLabel: string | null;
  title: string;
}): Promise<PerTemplateLog> {
  const t0 = Date.now();
  const label = t.templateLabel || t.title;
  const base = { pageId: t.id, tenantId: t.tenantId, slug: t.slug ?? "", label };
  if (isPlaceholderTemplateLabel(label)) {
    return { ...base, outcome: "skipped_placeholder", durationMs: Date.now() - t0 };
  }
  if (!t.slug) {
    return { ...base, outcome: "skipped_no_slug", durationMs: Date.now() - t0 };
  }
  const result = await captureTemplateThumbnail({ pageId: t.id });
  if (result.ok) {
    return { ...base, outcome: "succeeded", durationMs: Date.now() - t0 };
  }
  return { ...base, outcome: "failed", durationMs: Date.now() - t0, error: result.error ?? result.skipped };
}

async function main() {
  const args = parseArgs(process.argv);

  const whereClauses = [eq(lpPagesTable.isTemplate, true)];
  if (args.tenantId !== undefined) whereClauses.push(eq(lpPagesTable.tenantId, args.tenantId));
  // Default: only templates with no thumbnail yet. `--all` re-captures everything.
  if (!args.all) whereClauses.push(isNull(lpPagesTable.thumbnailUrl));

  const all = await db
    .select({
      id: lpPagesTable.id,
      tenantId: lpPagesTable.tenantId,
      slug: lpPagesTable.slug,
      templateLabel: lpPagesTable.templateLabel,
      title: lpPagesTable.title,
    })
    .from(lpPagesTable)
    .where(and(...whereClauses))
    .orderBy(lpPagesTable.id);

  const sliceStart = args.offset ?? 0;
  const sliceEnd = args.limit !== undefined ? sliceStart + args.limit : undefined;
  const templates = all.slice(sliceStart, sliceEnd);

  console.log(
    `[thumb-backfill] ${templates.length} candidate templates ` +
      `(slice ${sliceStart}..${sliceEnd ?? "end"} of ${all.length}, ` +
      `mode=${args.all ? "all" : "missing-only"}, concurrency=${args.concurrency})`,
  );

  const t0 = Date.now();
  const results: PerTemplateLog[] = [];
  const queue = [...templates];
  const workers: Promise<void>[] = [];
  for (let i = 0; i < args.concurrency; i++) {
    workers.push(
      (async () => {
        while (queue.length > 0) {
          const tpl = queue.shift();
          if (!tpl) return;
          const r = await processTemplate(tpl);
          console.log(JSON.stringify(r));
          results.push(r);
        }
      })(),
    );
  }
  await Promise.all(workers);

  const summary = {
    total: results.length,
    succeeded: results.filter((r) => r.outcome === "succeeded").length,
    failed: results.filter((r) => r.outcome === "failed").length,
    skipped_placeholder: results.filter((r) => r.outcome === "skipped_placeholder").length,
    skipped_no_slug: results.filter((r) => r.outcome === "skipped_no_slug").length,
    totalDurationMs: Date.now() - t0,
  };
  console.log("[thumb-backfill] summary", JSON.stringify(summary, null, 2));

  // Failures leave thumbnail_url NULL → re-runnable. Exit 0 so the script can be
  // re-run after transient thum.io failures without polluting CI signal.
  process.exit(0);
}

main().catch((err) => {
  console.error("[thumb-backfill] fatal", err);
  process.exit(2);
});
