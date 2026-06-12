/**
 * Backfill content + lp-purpose tags onto lp_media image rows created BEFORE
 * the synchronous-tagging fix in lib/brand-import/assets-uploader.ts.
 *
 * Those rows carry only provenance tags (["page-reference","scraped",
 * "refhost:…","refsrc:…"]), brand-import markers, or starter markers
 * (["starter","flagship"|"generic"|…]) — no content tags and no lp-* purpose
 * tag — so the AI page generator's scorer (routes/lp/generate-page.ts) gives
 * them 0 against every slot and image selection degenerates to arbitrary
 * picks. This script downloads each such image and runs it through the same
 * GPT-4o vision tagger the upload/mirror paths use (lib/imageAutoTag.ts),
 * preserving the existing provenance tags.
 *
 * Usage (from artifacts/api-server/):
 *   pnpm run retag-media-library -- --dry-run      # report counts only
 *   pnpm tsx scripts/retag-media-library.ts                  # all tenants + shared rows
 *   pnpm tsx scripts/retag-media-library.ts --tenant 42      # one tenant (also --tenant=42)
 *   pnpm tsx scripts/retag-media-library.ts --limit=200 --concurrency=3
 *
 * Idempotent / resumable: rows that already carry a purpose tag or a content
 * tag (see needsContentTagBackfill in lib/imageAutoTag.ts) are skipped, so
 * re-running after a partial failure only processes what's left. Per-image
 * failures are logged and never abort the run. OpenAI calls go through the
 * shared withOpenAIConcurrency semaphore so the backfill can't burst-429 the
 * proxy out from under a live brand import.
 *
 * Exit codes:
 *   0 — completed (possibly with per-image failures; re-run to retry them)
 *   1 — systemic failure: no DATABASE_URL / DB unreachable, or (non-dry-run)
 *       missing AI_INTEGRATIONS_OPENAI_API_KEY / _BASE_URL
 *
 * ⚠️  PRODUCTION DATA: the workspace `@workspace/db` connection points at the
 * production Neon database. This script WRITES `tags` on real lp_media rows
 * and makes one OpenAI vision call per untagged image. Run `--dry-run` first
 * and confirm the candidate count before launching for real.
 */

interface Args {
  dryRun: boolean;
  tenantId?: number;
  limit?: number;
  concurrency: number;
}

function parseArgs(argv: string[]): Args {
  const out: Args = { dryRun: false, concurrency: 3 };
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--dry-run") out.dryRun = true;
    else if (a === "--tenant") out.tenantId = Number(rest[++i]);
    else if (a.startsWith("--tenant=")) out.tenantId = Number(a.slice("--tenant=".length));
    else if (a.startsWith("--limit=")) out.limit = Math.max(1, Number(a.slice("--limit=".length)));
    else if (a === "--limit") out.limit = Math.max(1, Number(rest[++i]));
    else if (a.startsWith("--concurrency=")) out.concurrency = Math.max(1, Number(a.slice("--concurrency=".length)));
    else console.warn(`[retag-media] unknown arg ignored: ${a}`);
  }
  if (out.tenantId !== undefined && !Number.isFinite(out.tenantId)) {
    console.error("[retag-media] --tenant requires a numeric tenant id");
    process.exit(1);
  }
  return out;
}

/** Mime types the GPT-4o vision endpoint accepts. SVG/AVIF/ICO rows are
 *  counted + skipped (they are almost always logos/icons anyway). */
const TAGGABLE_MIMES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"]);

type Outcome = "tagged" | "still-untagged" | "download-failed" | "unsupported-mime" | "error";

interface RowLog {
  mediaId: number;
  tenantId: number | null;
  url: string;
  outcome: Outcome;
  durationMs: number;
  error?: string;
}

async function main() {
  const args = parseArgs(process.argv);

  // Systemic-failure check #1: vision credentials. Without them autoTagImage
  // silently no-ops, which would make a non-dry run look successful while
  // tagging nothing — fail loudly instead.
  const hasOpenAI =
    !!process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"] && !!process.env["AI_INTEGRATIONS_OPENAI_API_KEY"];
  if (!args.dryRun && !hasOpenAI) {
    console.error(
      "[retag-media] AI_INTEGRATIONS_OPENAI_API_KEY / AI_INTEGRATIONS_OPENAI_BASE_URL are not set — " +
        "the vision tagger cannot run. Set both env vars (or use --dry-run to only count candidates).",
    );
    process.exit(1);
  }

  // Systemic-failure check #2: database. @workspace/db throws at import time
  // when DATABASE_URL is missing, so import lazily and translate the error.
  let dbMod: typeof import("@workspace/db");
  try {
    dbMod = await import("@workspace/db");
  } catch (err) {
    console.error(`[retag-media] cannot connect to database: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
  const { db, lpMediaTable } = dbMod;
  const { eq, and, asc } = await import("drizzle-orm");
  const { autoTagImage, needsContentTagBackfill } = await import("../src/lib/imageAutoTag");
  const { withOpenAIConcurrency } = await import("../src/lib/brand-import/openai-semaphore");
  const { fetchAsset } = await import("../src/lib/brand-import/assets-uploader");
  const { ObjectStorageService } = await import("../src/lib/objectStorage");
  const objectStorage = new ObjectStorageService();

  const whereClauses = [eq(lpMediaTable.mediaType, "image")];
  if (args.tenantId !== undefined) whereClauses.push(eq(lpMediaTable.tenantId, args.tenantId));

  let rows: { id: number; tenantId: number | null; url: string; mimeType: string; tags: unknown }[];
  try {
    rows = await db
      .select({
        id: lpMediaTable.id,
        tenantId: lpMediaTable.tenantId,
        url: lpMediaTable.url,
        mimeType: lpMediaTable.mimeType,
        tags: lpMediaTable.tags,
      })
      .from(lpMediaTable)
      .where(and(...whereClauses))
      .orderBy(asc(lpMediaTable.id));
  } catch (err) {
    console.error(`[retag-media] media query failed (DB unreachable?): ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  const allCandidates = rows.filter((r) => needsContentTagBackfill(r.tags));
  const candidates = args.limit !== undefined ? allCandidates.slice(0, args.limit) : allCandidates;

  const stored = candidates.filter((c) => c.url.startsWith("/api/storage/objects/")).length;
  const external = candidates.filter((c) => /^https?:\/\//.test(c.url) || c.url.startsWith("data:")).length;
  const other = candidates.length - stored - external;
  console.log(
    `[retag-media] scanned ${rows.length} image rows` +
      `${args.tenantId !== undefined ? ` (tenant ${args.tenantId})` : ""}: ` +
      `${allCandidates.length} need backfill (processing ${candidates.length}; ` +
      `${stored} stored-object, ${external} external-url, ${other} other), ` +
      `${rows.length - allCandidates.length} already tagged/excluded`,
  );

  if (args.dryRun) {
    console.log("[retag-media] --dry-run: no images downloaded, no tags written");
    process.exit(0);
  }
  if (candidates.length === 0) {
    console.log("[retag-media] nothing to do");
    process.exit(0);
  }
  if (stored > 0 && !process.env["PRIVATE_OBJECT_DIR"]) {
    console.warn(
      "[retag-media] PRIVATE_OBJECT_DIR is not set — the " +
        `${stored} stored-object rows will fail to download (external-URL rows still process)`,
    );
  }

  /** Download the row's bytes, reusing the storage helper for /api/storage
   *  rows and the mirror's SSRF-guarded fetch for external URLs. */
  async function downloadRow(row: { url: string; mimeType: string }): Promise<
    { ok: true; buffer: Buffer; mimeType: string } | { ok: false; reason: string }
  > {
    if (row.url.startsWith("/api/storage/objects/")) {
      // Media URLs are stored as "/api/storage/objects/uploads/<id>"; strip the
      // serve prefix to recover the "/objects/..." path the storage service
      // expects (same convention as routes/storage.ts).
      try {
        const file = await objectStorage.getObjectEntityFile(row.url.slice("/api/storage".length));
        const [buffer] = await file.download();
        let mime = row.mimeType;
        if (!mime) {
          const [meta] = await file.getMetadata();
          mime = (meta.contentType as string) || "";
        }
        return { ok: true, buffer, mimeType: mime || "image/jpeg" };
      } catch (err) {
        return { ok: false, reason: `storage-download-failed: ${err instanceof Error ? err.message : String(err)}` };
      }
    }
    if (/^https?:\/\//.test(row.url) || row.url.startsWith("data:")) {
      const fetched = await fetchAsset(row.url);
      if (!fetched.ok) return { ok: false, reason: fetched.reason };
      return { ok: true, buffer: fetched.asset.buffer, mimeType: row.mimeType || fetched.asset.mimeType };
    }
    return { ok: false, reason: `unsupported-url-scheme: ${row.url.slice(0, 40)}` };
  }

  async function processRow(row: (typeof candidates)[number]): Promise<RowLog> {
    const t0 = Date.now();
    const base = { mediaId: row.id, tenantId: row.tenantId, url: row.url };
    try {
      const dl = await downloadRow(row);
      if (!dl.ok) {
        return { ...base, outcome: "download-failed", durationMs: Date.now() - t0, error: dl.reason };
      }
      if (!TAGGABLE_MIMES.has(dl.mimeType.toLowerCase())) {
        return { ...base, outcome: "unsupported-mime", durationMs: Date.now() - t0, error: dl.mimeType };
      }

      const existingTags = (Array.isArray(row.tags) ? row.tags : []).filter(
        (t): t is string => typeof t === "string",
      );
      // Scraped / brand-import rows mirrored before the source-page hero rule
      // can't tell us whether they were the actual hero on the source page, so
      // (like every non-hero image on the mirror path) they are forbidden the
      // lp-hero purpose — vision tags every lifestyle/people shot lp-hero, and
      // without document order the safe call is to keep them feature-only.
      const forbidHeroPurpose = existingTags.some((t) => {
        const l = t.toLowerCase();
        return l === "scraped" || l === "page-reference" || l === "brand-import";
      });

      // autoTagImage preserves the existing provenance tags (it strips only
      // stale purpose/og tags before merging) and never throws. Route the call
      // through the shared OpenAI semaphore so this backfill queues behind /
      // alongside live brand-import extractor traffic instead of bursting.
      await withOpenAIConcurrency(() =>
        autoTagImage(row.id, dl.buffer, dl.mimeType, existingTags, { forbidHeroPurpose }),
      );

      // autoTagImage swallows its own errors, so verify by re-reading the row.
      const [after] = await db
        .select({ tags: lpMediaTable.tags })
        .from(lpMediaTable)
        .where(eq(lpMediaTable.id, row.id))
        .limit(1);
      const tagged = !!after && !needsContentTagBackfill(after.tags);
      return { ...base, outcome: tagged ? "tagged" : "still-untagged", durationMs: Date.now() - t0 };
    } catch (err) {
      // Never let a single image abort the run.
      return { ...base, outcome: "error", durationMs: Date.now() - t0, error: err instanceof Error ? err.message : String(err) };
    }
  }

  const t0 = Date.now();
  const results: RowLog[] = [];
  const queue = [...candidates];
  let processed = 0;
  const workers: Promise<void>[] = [];
  for (let i = 0; i < args.concurrency; i++) {
    workers.push(
      (async () => {
        while (queue.length > 0) {
          const row = queue.shift();
          if (!row) return;
          const r = await processRow(row);
          results.push(r);
          processed++;
          if (r.outcome !== "tagged") console.log(JSON.stringify(r));
          if (processed % 25 === 0) {
            console.log(
              `[retag-media] progress ${processed}/${candidates.length} ` +
                `(tagged=${results.filter((x) => x.outcome === "tagged").length}, elapsed=${Math.round((Date.now() - t0) / 1000)}s)`,
            );
          }
        }
      })(),
    );
  }
  await Promise.all(workers);

  const summary = {
    candidates: candidates.length,
    tagged: results.filter((r) => r.outcome === "tagged").length,
    stillUntagged: results.filter((r) => r.outcome === "still-untagged").length,
    downloadFailed: results.filter((r) => r.outcome === "download-failed").length,
    unsupportedMime: results.filter((r) => r.outcome === "unsupported-mime").length,
    errors: results.filter((r) => r.outcome === "error").length,
    totalDurationMs: Date.now() - t0,
  };
  console.log("[retag-media] summary", JSON.stringify(summary, null, 2));

  // Failures leave the row untagged → the next run picks it up again
  // (re-runnable). Exit 0 so per-image flakiness doesn't read as systemic.
  process.exit(0);
}

main().catch((err) => {
  console.error("[retag-media] fatal", err);
  process.exit(2);
});
