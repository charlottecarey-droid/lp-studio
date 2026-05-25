/**
 * Asset presence check used at publish time (task #374, T050).
 *
 * Given freshly-rendered LP HTML, returns the set of `/assets/*` paths
 * referenced and which (if any) are missing from R2 under
 * `_studio-assets/assets/<basename>`. The publish pipeline aborts the
 * R2 HTML write when anything is missing — writing such HTML would
 * publish a guaranteed-broken page that visitors would hit until the
 * next redeploy+republish cycle.
 *
 * Separate from `assetHealthCheck.ts` because the check shape is
 * different: this one is fail-the-publish on miss, the other one is
 * sample-and-alert across all published pages.
 */
import { S3Client } from "@aws-sdk/client-s3";
import { extractAssetPaths, r2AssetExists } from "./assetRefs";

function getR2Cfg() {
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

export interface AssetPresenceResult {
  /** Total unique `/assets/*` references in the HTML. */
  checked: number;
  /** Subset that returned 404 from R2 (broken if we published). */
  missing: string[];
}

/**
 * HEAD every unique `/assets/*` reference in `html` against R2. Returns
 * `{checked: 0, missing: []}` when R2 isn't configured (dev/CI), so the
 * caller can treat that as "publish unconstrained."
 *
 * Modest concurrency keeps the per-publish overhead < 1s for a typical
 * page (~10 unique asset refs). HEAD failures other than 404 throw — we
 * don't want to misclassify a transient R2 outage as "missing" and
 * abort an otherwise-fine publish.
 */
export async function verifyAssetsForHtml(html: string): Promise<AssetPresenceResult> {
  const cfg = getR2Cfg();
  if (!cfg) return { checked: 0, missing: [] };
  const refs = extractAssetPaths(html);
  if (refs.length === 0) return { checked: 0, missing: [] };

  const CONCURRENCY = 8;
  const missing: string[] = [];
  const queue = [...refs];

  const worker = async () => {
    while (queue.length > 0) {
      const ref = queue.shift();
      if (!ref) return;
      const basename = ref.split("/").pop()!;
      const exists = await r2AssetExists(cfg.client, cfg.bucket, basename);
      if (!exists) missing.push(ref);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, refs.length) }, worker));
  return { checked: refs.length, missing };
}
