/**
 * Scheduled GC for R2 `_studio-assets/assets/*` (task #374, T070).
 *
 * Walks the studio-asset prefix and the prerendered HTML prefix in R2.
 * Any asset object that is BOTH:
 *   - not referenced by any current prerendered HTML, AND
 *   - older than 30 days
 * is deleted.
 *
 * 30 days is the safety window: a tenant who hasn't republished in
 * 30 days but is still serving the prerendered HTML still has every
 * asset their HTML references. The audit/health-check jobs (T060, T040)
 * catch any drift before the GC ever fires on a referenced object.
 *
 * First-run safety: gated by `LP_ASSETS_GC_DRY_RUN`. Default behavior
 * (no env var) is dry-run: log the candidate list and DO NOT delete.
 * Set `LP_ASSETS_GC_DRY_RUN=0` to enable deletion. This is a deliberate
 * opt-in: a bug here permanently deletes assets, and breaking >0 pages
 * is much worse than carrying a few MB of orphaned objects for a week.
 */
import * as Sentry from "@sentry/node";
import {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  NoSuchKey,
  NotFound,
} from "@aws-sdk/client-s3";
import { logger } from "./logger";
import { extractAssetPaths, STUDIO_ASSETS_PREFIX } from "./assetRefs";
import { buildR2S3Client, R2_SWEEP_MAX_SOCKETS } from "./r2Storage";

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

function getR2() {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET?.trim();
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    // Same hardening as assetPresenceCheck.ts (post-2026-05-25 white-page
    // incident RCA): in production, a missing R2 credential silently
    // disabling the daily GC is a regression we want to catch loudly at
    // boot, not by quietly accumulating dead objects forever. Local dev
    // still no-ops so devs without R2 access can run the server.
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
        `assetsGc: R2 credentials missing in production (${missing}). ` +
          `Daily asset GC cannot run; refusing to silently skip.`,
      );
    }
    return null;
  }
  const client = buildR2S3Client({ accountId, accessKeyId, secretAccessKey, maxSockets: R2_SWEEP_MAX_SOCKETS });
  return { client, bucket };
}

function isDryRun(): boolean {
  // Default to dry-run when the env var is missing or anything other than "0".
  const v = process.env.LP_ASSETS_GC_DRY_RUN;
  if (v === undefined) return true;
  return v.trim() !== "0";
}

async function listPrefix(
  client: S3Client,
  bucket: string,
  prefix: string,
): Promise<{ key: string; lastModified: Date | null }[]> {
  const out: { key: string; lastModified: Date | null }[] = [];
  let token: string | undefined;
  for (let page = 0; page < 100; page++) {
    const res = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }),
    );
    for (const obj of res.Contents ?? []) {
      if (!obj.Key) continue;
      out.push({ key: obj.Key, lastModified: obj.LastModified ?? null });
    }
    if (!res.IsTruncated) return out;
    token = res.NextContinuationToken;
  }
  throw new Error(`listPrefix: hit 100-page safety cap on prefix=${prefix}`);
}

async function readBody(client: S3Client, bucket: string, key: string): Promise<string | null> {
  try {
    const out = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    return (await out.Body?.transformToString("utf-8")) ?? null;
  } catch (err) {
    if (err instanceof NoSuchKey || err instanceof NotFound) return null;
    const n = err && typeof err === "object" && "name" in err ? (err as { name: string }).name : "";
    if (n === "NoSuchKey" || n === "NotFound") return null;
    throw err;
  }
}

let inflight: Promise<void> | null = null;

export function runAssetsGc(): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    const cfg = getR2();
    if (!cfg) {
      logger.debug("assetsGc: R2 not configured, skipping");
      return;
    }
    const dryRun = isDryRun();
    const t0 = Date.now();
    try {
      // 1. List every prerendered HTML object and collect referenced
      //    asset basenames. The HTML prefix is everything that doesn't
      //    start with `_` — both `_studio-assets/...` and any future
      //    underscore-prefixed system folders are reserved.
      const allObjects = await listPrefix(cfg.client, cfg.bucket, "");
      const htmlObjects = allObjects.filter((o) => !o.key.startsWith("_") && o.key.endsWith(".html"));
      const assetObjects = allObjects.filter((o) => o.key.startsWith(STUDIO_ASSETS_PREFIX));

      const referenced = new Set<string>();
      for (const obj of htmlObjects) {
        const html = await readBody(cfg.client, cfg.bucket, obj.key);
        if (!html) continue;
        for (const ref of extractAssetPaths(html)) {
          // Asset basename = R2 sub-key after `_studio-assets/assets/`.
          referenced.add(ref.split("/").pop()!);
        }
      }

      const cutoff = Date.now() - RETENTION_MS;
      const candidates: { key: string; lastModified: Date | null }[] = [];
      for (const obj of assetObjects) {
        const sub = obj.key.slice(STUDIO_ASSETS_PREFIX.length);
        const basename = sub.split("/").pop()!;
        if (referenced.has(basename)) continue;
        if (!obj.lastModified) continue; // be conservative — no timestamp → keep
        if (obj.lastModified.getTime() >= cutoff) continue;
        candidates.push(obj);
      }

      logger.info(
        {
          dryRun,
          htmlCount: htmlObjects.length,
          assetCount: assetObjects.length,
          referencedCount: referenced.size,
          candidateCount: candidates.length,
          durationMs: Date.now() - t0,
        },
        dryRun
          ? "assetsGc: dry-run, no deletes performed"
          : "assetsGc: deleting unreferenced+stale assets",
      );

      if (dryRun) {
        // Log a sample of candidates so an operator can spot-check before flipping the switch.
        if (candidates.length > 0) {
          logger.info(
            { sample: candidates.slice(0, 10).map((c) => c.key) },
            "assetsGc: candidate sample",
          );
        }
        return;
      }

      let deleted = 0;
      let failed = 0;
      for (const obj of candidates) {
        try {
          await cfg.client.send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: obj.key }));
          deleted++;
        } catch (err) {
          failed++;
          logger.warn({ err, key: obj.key }, "assetsGc: delete failed");
        }
      }
      logger.info({ deleted, failed, candidateCount: candidates.length }, "assetsGc: complete");
      if (failed > 0) {
        Sentry.captureMessage("lp_assets_gc_partial_failure", {
          level: "warning",
          tags: { subsystem: "lp-prerender", outcome: "gc_partial_failure" },
          extra: { deleted, failed, candidateCount: candidates.length },
        });
      }
    } catch (err) {
      logger.error({ err }, "assetsGc: failed");
      Sentry.captureMessage("lp_assets_gc_failed", {
        level: "error",
        tags: { subsystem: "lp-prerender", outcome: "gc_failed" },
        extra: { error: err instanceof Error ? err.message : String(err) },
      });
    }
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}
