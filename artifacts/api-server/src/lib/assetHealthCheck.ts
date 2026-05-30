/**
 * Periodic asset health check (tasks #374 T060 + #379).
 *
 * Walks every published landing page, fetches its R2-stored HTML,
 * extracts every referenced `/assets/*` path, and HEADs each one
 * against R2 under `_studio-assets/assets/<basename>`. Persists the
 * outcome to `lp_pages.asset_health_result` + `asset_health_checked_at`
 * so the SuperAdmin asset-health dashboard (task #379) can render the
 * fleet-wide "X% broken" headline without re-running the probe.
 *
 * Alerts via Sentry + structured log when anything is missing — the
 * canary that catches a regression of the lp-studio build hook (script
 * not run on deploy, R2 creds missing in build env, asset upload bug)
 * before it bites a real visitor.
 *
 * Cheap: every tick scans ~85 pages (current prod fleet) at concurrency
 * 8 → ~5s wall time. Default cadence is 15 minutes.
 *
 * NOT for fixing problems — only detecting them. The fix is to redeploy
 * lp-studio (build hook reuploads assets) or to run
 * `scripts/backfill-published-html.ts` to refresh stale prerendered HTML
 * (or hit the per-page "Republish" button on the dashboard).
 */
import * as Sentry from "@sentry/node";
import { S3Client, GetObjectCommand, NoSuchKey, NotFound } from "@aws-sdk/client-s3";
import { db, lpPagesTable } from "@workspace/db";
import { desc, eq, sql } from "drizzle-orm";
import { logger } from "./logger";
import { getActiveHostsForTenant } from "./tenantHosts";
import { extractAssetPaths, r2AssetExists } from "./assetRefs";
import { buildR2S3Client } from "./r2Storage";

const CONCURRENCY = 8;

export interface BrokenAsset {
  /** /assets/<file> reference as it appears in the HTML. */
  path: string;
  /**
   * ISO timestamp the very first sweep that observed this path missing.
   * Preserved across rechecks so operators can see how long a page has been
   * broken (the 2026-05-25 incident review specifically asked for this).
   */
  firstSeenBrokenAt: string;
}

export interface AssetHealthResult {
  /** Unique /assets/* references found in the HTML. 0 when hadHtml=false. */
  checked: number;
  /** Subset of references that returned 404 from R2. */
  brokenAssets: BrokenAsset[];
  /** Host the lookup used. Empty string when no active host for the tenant. */
  host: string;
  /** Whether R2 HTML existed for this page (false → not yet prerendered). */
  hadHtml: boolean;
}

function getR2() {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET?.trim();
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    // Same hardening as assetPresenceCheck.ts (post-2026-05-25 white-page
    // incident RCA): silently no-opping in production means the canary
    // never alerts when the dashboard most needs it. Local dev still
    // no-ops so developers without R2 access can run the server.
    if (process.env.NODE_ENV === "production") {
      const missing = [
        !accountId && "R2_ACCOUNT_ID",
        !accessKeyId && "R2_ACCESS_KEY_ID",
        !secretAccessKey && "R2_SECRET_ACCESS_KEY",
        !bucket && "R2_BUCKET",
      ]
        .filter(Boolean)
        .join(", ");
      throw new Error(
        `assetHealthCheck: R2 credentials missing in production (${missing}). ` +
          `Scheduled asset-health probe cannot run; refusing to silently skip.`,
      );
    }
    return null;
  }
  const client = buildR2S3Client({ accountId, accessKeyId, secretAccessKey });
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

async function checkOnePage(
  cfg: { client: S3Client; bucket: string },
  page: { id: number; tenantId: number; slug: string },
  priorBroken: Map<string, string>,
): Promise<AssetHealthResult> {
  const hosts = await getActiveHostsForTenant(page.tenantId);
  const host = hosts[0] ?? "";
  if (!host) {
    return { checked: 0, brokenAssets: [], host: "", hadHtml: false };
  }
  const html = await readR2Html(cfg.client, cfg.bucket, host, page.slug);
  if (!html) {
    return { checked: 0, brokenAssets: [], host, hadHtml: false };
  }
  const assets = Array.from(new Set(extractAssetPaths(html)));
  // Per-page HEAD fan-out is also bounded: most pages reference 2-4 assets.
  const presence = await Promise.all(
    assets.map(async (ref) => {
      const basename = ref.split("/").pop()!;
      const exists = await r2AssetExists(cfg.client, cfg.bucket, basename);
      return { ref, exists };
    }),
  );
  const nowIso = new Date().toISOString();
  const broken: BrokenAsset[] = [];
  for (const p of presence) {
    if (p.exists) continue;
    // Preserve the original first-seen timestamp across rechecks. If a path
    // newly disappeared (or this is the first ever check), stamp it now.
    broken.push({ path: p.ref, firstSeenBrokenAt: priorBroken.get(p.ref) ?? nowIso });
  }
  return { checked: assets.length, brokenAssets: broken, host, hadHtml: true };
}

function brokenIndexFromRow(value: unknown): Map<string, string> {
  const out = new Map<string, string>();
  if (!value || typeof value !== "object") return out;
  const arr = (value as { brokenAssets?: unknown }).brokenAssets;
  if (!Array.isArray(arr)) return out;
  for (const item of arr) {
    if (typeof item === "string") {
      // Legacy shape — preserve nothing, the next sweep will stamp now.
      continue;
    }
    if (item && typeof item === "object" && typeof (item as BrokenAsset).path === "string") {
      const b = item as BrokenAsset;
      if (typeof b.firstSeenBrokenAt === "string") out.set(b.path, b.firstSeenBrokenAt);
    }
  }
  return out;
}

export async function persistResult(pageId: number, result: AssetHealthResult): Promise<void> {
  await db
    .update(lpPagesTable)
    .set({
      assetHealthCheckedAt: new Date(),
      assetHealthResult: result,
      // This is a background canary write, not a user edit. Explicitly
      // self-assign updatedAt to its current value so Drizzle's $onUpdate
      // hook does NOT auto-stamp now() — otherwise every published page's
      // "last edited" time gets bumped on each scan, scrambling the
      // dashboard "recent work" + pages-list sort. (task #490)
      updatedAt: sql`${lpPagesTable.updatedAt}`,
    })
    .where(eq(lpPagesTable.id, pageId));
}

// Single-flight guard so a slow probe doesn't overlap the next tick.
let inflight: Promise<void> | null = null;

export function runAssetHealthCheck(): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    const cfg = getR2();
    if (!cfg) {
      logger.debug("assetHealthCheck: R2 not configured, skipping");
      return;
    }
    const r2: { client: S3Client; bucket: string } = cfg;
    try {
      const pages = await db
        .select({
          id: lpPagesTable.id,
          tenantId: lpPagesTable.tenantId,
          slug: lpPagesTable.slug,
          assetHealthResult: lpPagesTable.assetHealthResult,
        })
        .from(lpPagesTable)
        .where(eq(lpPagesTable.status, "published"))
        .orderBy(desc(lpPagesTable.updatedAt));

      let checkedPages = 0;
      let healthyPages = 0;
      let brokenPages = 0;
      let noHtmlPages = 0;
      const brokenSample: { pageId: number; slug: string; host: string; missing: string[] }[] = [];

      // Fixed-size worker pool over the page list.
      let cursor = 0;
      async function worker() {
        while (cursor < pages.length) {
          const i = cursor++;
          const page = pages[i];
          try {
            const priorBroken = brokenIndexFromRow(page.assetHealthResult);
            const result = await checkOnePage(r2, page, priorBroken);
            await persistResult(page.id, result);
            checkedPages++;
            if (!result.hadHtml) {
              noHtmlPages++;
            } else if (result.brokenAssets.length === 0) {
              healthyPages++;
            } else {
              brokenPages++;
              if (brokenSample.length < 10) {
                brokenSample.push({
                  pageId: page.id,
                  slug: page.slug,
                  host: result.host,
                  missing: result.brokenAssets.map((b) => b.path),
                });
              }
            }
          } catch (err) {
            // Per-page failure shouldn't kill the whole sweep — log and
            // continue. The row simply isn't updated this tick.
            logger.warn(
              { err, pageId: page.id, slug: page.slug },
              "assetHealthCheck: per-page probe failed",
            );
          }
        }
      }
      await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

      if (brokenPages > 0) {
        logger.error(
          {
            totalPages: pages.length,
            checkedPages,
            healthyPages,
            brokenPages,
            noHtmlPages,
            brokenSample,
          },
          "assetHealthCheck: published pages reference missing assets — lp-studio deploy may have skipped the R2 asset upload step",
        );
        Sentry.captureMessage("lp_asset_health_broken", {
          level: "error",
          tags: { subsystem: "lp-prerender", outcome: "asset_missing" },
          extra: { totalPages: pages.length, checkedPages, healthyPages, brokenPages, brokenSample },
        });
      } else {
        logger.info(
          { totalPages: pages.length, checkedPages, healthyPages, noHtmlPages },
          "assetHealthCheck: ok",
        );
      }
    } catch (err) {
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

/**
 * Run a single-page probe on demand and persist the result. Used by the
 * SuperAdmin "Re-check" button so an operator can refresh one row
 * without waiting for the 15-minute tick. Returns the persisted result
 * (or null when R2 isn't configured, e.g. local dev).
 */
export async function recheckOnePage(
  pageId: number,
): Promise<AssetHealthResult | null> {
  const cfg = getR2();
  if (!cfg) return null;
  const [page] = await db
    .select({
      id: lpPagesTable.id,
      tenantId: lpPagesTable.tenantId,
      slug: lpPagesTable.slug,
      assetHealthResult: lpPagesTable.assetHealthResult,
    })
    .from(lpPagesTable)
    .where(eq(lpPagesTable.id, pageId))
    .limit(1);
  if (!page) return null;
  const priorBroken = brokenIndexFromRow(page.assetHealthResult);
  const result = await checkOnePage(cfg, page, priorBroken);
  await persistResult(page.id, result);
  return result;
}

// Silence unused-import warning while keeping `sql` available for future
// raw-SQL needs in this module (drizzle re-exports it from the package).
void sql;
