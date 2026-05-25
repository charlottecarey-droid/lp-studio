/**
 * Periodic asset health check (task #374, T060).
 *
 * Samples a small number of recently-published landing pages from R2,
 * extracts one referenced `/assets/*` JS path from each, and confirms
 * the asset is present in R2 under `_studio-assets/assets/<basename>`.
 * Alerts via Sentry + structured log when an asset is missing — the
 * canary that catches a regression of the lp-studio build hook (script
 * not run on deploy, R2 creds missing in build env, asset upload bug)
 * before it bites a real visitor.
 *
 * Cheap: O(SAMPLE_SIZE) R2 GETs + HEADs per run. Default cadence is 15
 * minutes so a regression surfaces within one cycle.
 *
 * NOT for fixing problems — only detecting them. The fix is to redeploy
 * lp-studio (build hook reuploads assets) or to run
 * `scripts/backfill-published-html.ts` to refresh stale prerendered HTML.
 */
import * as Sentry from "@sentry/node";
import { S3Client, GetObjectCommand, NoSuchKey, NotFound } from "@aws-sdk/client-s3";
import { db, lpPagesTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { logger } from "./logger";
import { getActiveHostsForTenant } from "./tenantHosts";
import { extractAssetPaths, r2AssetExists } from "./assetRefs";

const SAMPLE_SIZE = 10;

function getR2() {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET?.trim();
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });
  return { client, bucket };
}

function normalizeHostForKey(host: string) {
  return host.split(":")[0].trim().toLowerCase();
}

async function readR2Html(
  client: S3Client,
  bucket: string,
  host: string,
  slug: string,
): Promise<string | null> {
  try {
    const out = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: `${encodeURIComponent(normalizeHostForKey(host))}/${encodeURIComponent(slug)}.html`,
      }),
    );
    return (await out.Body?.transformToString("utf-8")) ?? null;
  } catch (err) {
    if (err instanceof NoSuchKey || err instanceof NotFound) return null;
    const n = err && typeof err === "object" && "name" in err ? (err as { name: string }).name : "";
    if (n === "NoSuchKey" || n === "NotFound") return null;
    throw err;
  }
}

// Single-flight guard so a slow probe doesn't overlap the next tick.
let inflight: Promise<void> | null = null;

export function runAssetHealthCheck(): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    const cfg = getR2();
    if (!cfg) {
      // No R2 in dev → nothing to check; log once-per-tick at debug.
      logger.debug("assetHealthCheck: R2 not configured, skipping");
      return;
    }
    try {
      // Sample the SAMPLE_SIZE most-recently-updated published pages.
      // Most-recent is the right bias: a recently-published page is the
      // one most likely to exercise the *current* asset pipeline, and
      // an asset miss on a fresh page is the most actionable signal.
      const pages = await db
        .select({ id: lpPagesTable.id, tenantId: lpPagesTable.tenantId, slug: lpPagesTable.slug })
        .from(lpPagesTable)
        .where(eq(lpPagesTable.status, "published"))
        .orderBy(desc(lpPagesTable.updatedAt))
        .limit(SAMPLE_SIZE);

      let checked = 0;
      let healthy = 0;
      const broken: { pageId: number; slug: string; host: string; missing: string }[] = [];

      for (const page of pages) {
        const hosts = await getActiveHostsForTenant(page.tenantId);
        if (hosts.length === 0) continue;
        const host = hosts[0];
        const html = await readR2Html(cfg.client, cfg.bucket, host, page.slug);
        if (!html) continue; // page not yet in R2 — not this job's problem
        const assets = extractAssetPaths(html);
        // Look for a JS asset specifically — the entrypoint script is
        // the load-bearing reference. CSS missing is also bad but JS
        // missing is fatal first.
        const jsRef = assets.find((a) => a.endsWith(".js") || a.endsWith(".mjs"));
        if (!jsRef) continue;
        checked++;
        const basename = jsRef.split("/").pop()!;
        const exists = await r2AssetExists(cfg.client, cfg.bucket, basename);
        if (exists) {
          healthy++;
        } else {
          broken.push({ pageId: page.id, slug: page.slug, host, missing: jsRef });
        }
      }

      if (broken.length > 0) {
        logger.error(
          { checked, healthy, brokenCount: broken.length, broken: broken.slice(0, 5) },
          "assetHealthCheck: published pages reference missing assets — lp-studio deploy may have skipped the R2 asset upload step",
        );
        Sentry.captureMessage("lp_asset_health_broken", {
          level: "error",
          tags: { subsystem: "lp-prerender", outcome: "asset_missing" },
          extra: { checked, healthy, brokenCount: broken.length, broken: broken.slice(0, 10) },
        });
      } else {
        logger.info({ checked, healthy }, "assetHealthCheck: ok");
      }
    } catch (err) {
      // A failure of the health check itself is non-fatal; log + Sentry
      // so we know the canary itself is silent.
      logger.error({ err }, "assetHealthCheck: probe failed");
      Sentry.captureMessage("lp_asset_health_probe_failed", {
        level: "warning",
        tags: { subsystem: "lp-prerender", outcome: "probe_failed" },
        extra: { error: err instanceof Error ? err.message : String(err) },
      });
    }
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}
