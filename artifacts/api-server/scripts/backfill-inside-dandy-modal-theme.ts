/**
 * One-shot backfill: set `props.modalTheme = "dark"` on every existing
 * `sticky-header` and `id-hero` block instance stored under
 * `lp_pages.blocks`, where the field is currently unset.
 *
 * Why this exists (Task #386, follow-up to #383)
 * ------------------------------------------------
 * Task #383 forwarded `modalTheme` through the two block components and
 * set `modalTheme: "dark"` on the registry `defaultProps` for
 * `sticky-header` and `id-hero`. That fixes *newly added* blocks but
 * does nothing for pages already saved in the database — their stored
 * block instances have no `modalTheme` key, so the component's
 * `props.modalTheme ?? "light"` fallback keeps the white-framed modal
 * on the live Inside Dandy page until each block is re-saved.
 *
 * Identification rule — what counts as an "Inside Dandy page"
 * ------------------------------------------------------------
 * The narrowest correct rule we can apply from data alone: a page is
 * "Inside Dandy" if it contains at least one block of type
 * `sticky-header` or `id-hero`. These two block types are themselves
 * Inside-Dandy-flavored — the registry labels them "Inside Dandy ·
 * Hero" / sticky-hero header (dark glass + citron CTA) and their
 * defaults paint a dark cinematic shell. They are not used on any
 * other template family today. Filtering by template_slug is not
 * possible because the shipped Inside Dandy templates
 * (`inside-dandy-event`, `inside-dandy-spatial-tour`) seed only the
 * mega-blocks `event-page` / `spatial-tour`, not these two blocks —
 * the live broken pages were hand-composed from the block library.
 *
 * `--tenant=<id>` and `--slug=<slug>` further narrow the candidate set
 * for surgical runs (e.g. the Dandy partners tenant only).
 *
 * Behavior
 * --------
 *   - Dry-run is the default. `--apply` performs writes.
 *   - Per-page transaction: row is updated only when at least one
 *     block changed. Race with a concurrent editor is bounded to "one
 *     editor save loses the modal-theme bump" — re-run is safe.
 *   - After `--apply`, each touched page with `status="published"`
 *     is re-rendered via the same path the publish flow uses
 *     (renderAndStoreNow) so the prerendered HTML in R2/OS picks up
 *     the dark modal shell. Concurrency is capped (default 3) to
 *     avoid overloading the prerender renderer.
 *   - Idempotent: rows whose blocks already have `modalTheme` set
 *     (whether `"dark"` or `"light"`) are left untouched.
 *
 * Usage (from artifacts/api-server/)
 * ----------------------------------
 *   pnpm tsx scripts/backfill-inside-dandy-modal-theme.ts
 *   pnpm tsx scripts/backfill-inside-dandy-modal-theme.ts --apply
 *   pnpm tsx scripts/backfill-inside-dandy-modal-theme.ts --tenant=42 --apply
 *   pnpm tsx scripts/backfill-inside-dandy-modal-theme.ts --slug=dandy-ai-lp-copy --tenant=42 --apply
 *   pnpm tsx scripts/backfill-inside-dandy-modal-theme.ts --apply --no-republish
 *   pnpm tsx scripts/backfill-inside-dandy-modal-theme.ts --apply --republish-concurrency=5
 */
import { db, lpPagesTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { renderAndStoreNow } from "../src/lib/triggerPublishedRender";

const TARGET_TYPES = new Set(["sticky-header", "id-hero"]);

interface Args {
  tenantId?: number;
  slug?: string;
  apply: boolean;
  republish: boolean;
  republishConcurrency: number;
}

function parseArgs(argv: string[]): Args {
  const out: Args = { apply: false, republish: true, republishConcurrency: 3 };
  for (const a of argv.slice(2)) {
    if (a.startsWith("--tenant=")) out.tenantId = Number(a.slice("--tenant=".length));
    else if (a.startsWith("--slug=")) out.slug = a.slice("--slug=".length);
    else if (a === "--apply") out.apply = true;
    else if (a === "--dry-run") out.apply = false;
    else if (a === "--no-republish") out.republish = false;
    else if (a.startsWith("--republish-concurrency=")) {
      out.republishConcurrency = Math.max(1, Number(a.slice("--republish-concurrency=".length)));
    } else if (a === "--help" || a === "-h") {
      console.log(
        "Usage: pnpm tsx scripts/backfill-inside-dandy-modal-theme.ts " +
          "[--apply] [--tenant=N] [--slug=S] [--no-republish] [--republish-concurrency=N]",
      );
      process.exit(0);
    } else {
      console.warn(`[backfill-modal-theme] unknown arg: ${a}`);
    }
  }
  return out;
}

/**
 * Recursively walk a block tree, mutating `props.modalTheme = "dark"`
 * on any `sticky-header` / `id-hero` block whose `modalTheme` key is
 * absent. Returns the number of block instances mutated. Existing
 * values (`"dark"` or `"light"`) are preserved — idempotent on re-run
 * and never overrides a deliberate `"light"` opt-out.
 *
 * The walker is type-loose on purpose: stored block JSON has drifted
 * across the lifetime of the table (older versions lacked `children`,
 * some container variants store children in differently-named keys).
 * We defensively look at any property whose value is an array of
 * objects with a `type` field and recurse into it.
 */
function backfillBlocksInPlace(node: unknown): number {
  if (node == null || typeof node !== "object") return 0;
  let n = 0;
  if (Array.isArray(node)) {
    for (const child of node) n += backfillBlocksInPlace(child);
    return n;
  }
  const obj = node as Record<string, unknown>;
  const type = typeof obj.type === "string" ? obj.type : null;
  if (type && TARGET_TYPES.has(type)) {
    const props = (obj.props ?? {}) as Record<string, unknown>;
    if (!Object.prototype.hasOwnProperty.call(props, "modalTheme")) {
      props.modalTheme = "dark";
      obj.props = props;
      n += 1;
    }
  }
  // Recurse into any plausible child slot. `children` is the standard
  // container slot today; we also probe other array-of-object keys so
  // we don't miss historical variants.
  for (const [k, v] of Object.entries(obj)) {
    if (k === "props") continue;
    if (Array.isArray(v)) {
      // Only recurse into arrays that look like block lists (objects
      // with a `type` field). Skips primitive arrays like `navLinks`.
      if (v.length > 0 && v.every((x) => x && typeof x === "object" && !Array.isArray(x))) {
        const looksLikeBlocks = v.some((x) => typeof (x as Record<string, unknown>).type === "string");
        if (looksLikeBlocks) n += backfillBlocksInPlace(v);
      }
    }
  }
  return n;
}

interface PageUpdate {
  pageId: number;
  tenantId: number;
  slug: string;
  status: string;
  blocksChanged: number;
  newBlocks: unknown;
}

async function findCandidates(args: Args): Promise<PageUpdate[]> {
  // Scope: any page that contains at least one `sticky-header` or
  // `id-hero` block at the top level. The JSONB containment operator
  // matches when the block array contains an object with `type` equal
  // to one of the two values. Top-level containment is sufficient
  // because in current data these block types are top-level page
  // chrome — but we still recurse during the rewrite to be safe.
  const where = [
    sql`(
      ${lpPagesTable.blocks} @> '[{"type":"sticky-header"}]'::jsonb
      OR ${lpPagesTable.blocks} @> '[{"type":"id-hero"}]'::jsonb
    )`,
  ];
  if (args.tenantId !== undefined) where.push(eq(lpPagesTable.tenantId, args.tenantId));
  if (args.slug !== undefined) where.push(eq(lpPagesTable.slug, args.slug));

  const rows = await db
    .select({
      id: lpPagesTable.id,
      tenantId: lpPagesTable.tenantId,
      slug: lpPagesTable.slug,
      status: lpPagesTable.status,
      blocks: lpPagesTable.blocks,
    })
    .from(lpPagesTable)
    .where(and(...where))
    .orderBy(lpPagesTable.id);

  const updates: PageUpdate[] = [];
  for (const row of rows) {
    // Deep clone so the in-place walker doesn't mutate the drizzle
    // result object we may want to log later.
    const cloned: unknown = JSON.parse(JSON.stringify(row.blocks ?? []));
    const changed = backfillBlocksInPlace(cloned);
    if (changed > 0) {
      updates.push({
        pageId: row.id,
        tenantId: row.tenantId,
        slug: row.slug,
        status: row.status,
        blocksChanged: changed,
        newBlocks: cloned,
      });
    }
  }
  return updates;
}

async function applyUpdates(updates: PageUpdate[]): Promise<{ applied: number; failed: number }> {
  let applied = 0;
  let failed = 0;
  for (const u of updates) {
    try {
      // Per-page transaction. Drizzle's update with the row id is a
      // single statement so wrapping in db.transaction is unnecessary,
      // but using it makes the intent explicit and keeps the per-page
      // failure boundary clean.
      await db.transaction(async (tx) => {
        await tx
          .update(lpPagesTable)
          .set({ blocks: u.newBlocks as never })
          .where(eq(lpPagesTable.id, u.pageId));
      });
      applied += 1;
      console.log(JSON.stringify({ phase: "apply", outcome: "ok", ...summarize(u) }));
    } catch (err) {
      failed += 1;
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn(JSON.stringify({ phase: "apply", outcome: "failed", error: errMsg, ...summarize(u) }));
    }
  }
  return { applied, failed };
}

async function republishUpdated(
  updates: PageUpdate[],
  concurrency: number,
): Promise<{ republished: number; renderFailed: number; r2Failed: number; skipped: number }> {
  const targets = updates.filter((u) => u.status === "published");
  if (targets.length === 0) {
    return { republished: 0, renderFailed: 0, r2Failed: 0, skipped: 0 };
  }
  console.log(`[backfill-modal-theme] re-publishing ${targets.length} updated pages (concurrency=${concurrency})`);

  let republished = 0;
  let renderFailed = 0;
  let r2Failed = 0;
  let skipped = 0;

  const queue = [...targets];
  const workers: Promise<void>[] = [];
  for (let i = 0; i < concurrency; i++) {
    workers.push(
      (async () => {
        while (queue.length > 0) {
          const u = queue.shift();
          if (!u) return;
          const t0 = Date.now();
          const result = await renderAndStoreNow({ pageId: u.pageId, requestHost: null });
          const outcome =
            result.r2Ok && result.osOk
              ? "ok"
              : result.skipped === "render_failed" || result.skipped === "render_failed_assets_missing"
                ? "render_failed"
                : result.skipped === "r2_write_failed"
                  ? "r2_write_failed"
                  : result.skipped ?? "ok";
          if (outcome === "ok") republished += 1;
          else if (outcome === "render_failed") renderFailed += 1;
          else if (outcome === "r2_write_failed") r2Failed += 1;
          else skipped += 1;
          console.log(
            JSON.stringify({
              phase: "republish",
              outcome,
              pageId: u.pageId,
              tenantId: u.tenantId,
              slug: u.slug,
              durationMs: Date.now() - t0,
              error: result.error,
            }),
          );
        }
      })(),
    );
  }
  await Promise.all(workers);
  return { republished, renderFailed, r2Failed, skipped };
}

function summarize(u: PageUpdate): Record<string, unknown> {
  return {
    pageId: u.pageId,
    tenantId: u.tenantId,
    slug: u.slug,
    status: u.status,
    blocksChanged: u.blocksChanged,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  console.log(`[backfill-modal-theme] mode=${args.apply ? "APPLY" : "DRY-RUN"} tenant=${args.tenantId ?? "*"} slug=${args.slug ?? "*"}`);

  const updates = await findCandidates(args);
  console.log(`[backfill-modal-theme] candidate pages: ${updates.length}`);
  for (const u of updates) {
    console.log(JSON.stringify({ phase: "plan", ...summarize(u) }));
  }
  const totalBlocks = updates.reduce((s, u) => s + u.blocksChanged, 0);
  const publishedCount = updates.filter((u) => u.status === "published").length;
  console.log(`[backfill-modal-theme] would update ${updates.length} pages (${totalBlocks} block instances); ${publishedCount} are published`);

  if (!args.apply) {
    console.log(`[backfill-modal-theme] dry-run complete. Re-run with --apply to write.`);
    process.exit(0);
  }

  const applyResult = await applyUpdates(updates);
  console.log(`[backfill-modal-theme] apply: ${applyResult.applied} ok, ${applyResult.failed} failed`);

  let republishSummary = { republished: 0, renderFailed: 0, r2Failed: 0, skipped: 0 };
  if (args.republish) {
    // Re-publish every candidate (the per-page apply log above shows
    // which writes succeeded). A page whose data update failed is a
    // benign no-op here — the prerender uses the current db state,
    // which is the *pre-update* state for that page, so it just
    // re-renders the existing HTML. Safer than trying to thread per-
    // page success through and risking an inconsistent skip.
    republishSummary = await republishUpdated(updates, args.republishConcurrency);
  } else {
    console.log(`[backfill-modal-theme] --no-republish: skipping re-render of touched published pages`);
  }

  const summary = {
    candidatePages: updates.length,
    blockInstancesUpdated: totalBlocks,
    applied: applyResult.applied,
    applyFailed: applyResult.failed,
    publishedAffected: publishedCount,
    republished: republishSummary.republished,
    republishRenderFailed: republishSummary.renderFailed,
    republishR2Failed: republishSummary.r2Failed,
    republishSkipped: republishSummary.skipped,
  };
  console.log("[backfill-modal-theme] summary " + JSON.stringify(summary, null, 2));

  // Non-zero exit only if a data write failed or a re-publish left R2
  // stale. Render failures (rare, retried by the prerender path) are
  // exit-zero so the script can be re-run safely.
  process.exit(applyResult.failed > 0 || republishSummary.r2Failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("[backfill-modal-theme] fatal", err);
  process.exit(2);
});
