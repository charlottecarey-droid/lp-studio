/**
 * Cloudflare R2 mirror for prerendered published landing-page HTML.
 *
 * THIS is the visitor-facing read source. The CF worker
 * (cloudflare/og-bot-router) reads from R2 directly via a native binding;
 * api-server never reads from R2 in the request path. The api-server's
 * `readPublishedHtml` (Replit Object Storage) is the debug-only read path
 * surfaced through `GET /api/lp/rendered/:slug`.
 *
 * Write consistency model (task #364):
 *   - The DB row `lp_pages.status` is the absolute source of truth.
 *   - Both Replit OS and R2 are caches converging to it.
 *   - R2 write is AWAITED inside `triggerPublishedRender`; OS write is
 *     fire-and-forget AFTER R2 succeeds.
 *   - Invariant preserved: **OS never holds a version newer than R2.**
 *     R2-first write order plus skip-OS-on-R2-failure guarantees this; the
 *     only drift direction is "OS lags R2," which is benign because OS is
 *     only consulted by the debug endpoint.
 *   - On R2 write failure: structured Sentry message (`prerender_r2_write_failed`)
 *     plus warn-level log; no auto-retry. Healing happens via the next
 *     publish/edit or by running `scripts/backfill-published-html.ts`.
 *
 * Key layout: `<tenantId>/<encodeURIComponent(slug)>.html`. Tenant scope
 * lives in the key, not the bucket — one bucket per CF account is enough.
 *
 * Object-level access control: NONE at the R2 layer. The bucket is private
 * (no public access policy), the worker is the only reader, and the worker
 * resolves which (tenant, slug) to read from the request Host header
 * exactly the way api-server's `findTenantByHost` does. Cross-tenant slug
 * collisions can't escape because each tenant maps to its own host(s).
 */
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  NoSuchKey,
  NotFound,
} from "@aws-sdk/client-s3";

let cachedClient: S3Client | null = null;
let cachedBucket: string | null = null;

function getR2Config(): { client: S3Client; bucket: string } | null {
  // Defensive trim: a stray leading/trailing space in a secret value (easy
  // copy-paste mistake) silently breaks R2 with confusing errors — a space in
  // the bucket name routes to a malformed subdomain and CF returns generic
  // 403 AccessDenied, which looks like a permissions problem. Trim once at
  // the boundary so the rest of the code never has to think about it.
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET?.trim();

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    return null;
  }

  if (!cachedClient || cachedBucket !== bucket) {
    cachedClient = new S3Client({
      region: "auto",
      // R2 S3-compatible endpoint. Per CF docs:
      //   https://<ACCOUNT_ID>.r2.cloudflarestorage.com
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
      // R2 doesn't support some S3 features; force path-style addressing
      // to avoid SDK trying to do virtual-host-style with a non-AWS host.
      forcePathStyle: true,
    });
    cachedBucket = bucket;
  }
  return { client: cachedClient, bucket };
}

/** True if R2 credentials are present. Callers use this to decide whether
 *  to attempt R2 writes at all — in environments without R2 (some dev
 *  setups, ephemeral CI), we fall back to OS-only without erroring. */
export function isR2Configured(): boolean {
  return getR2Config() !== null;
}

function r2KeyFor(tenantId: number, slug: string): string {
  // Slug is URL-safe per schema validation, but encode defensively against
  // any path-traversal attempt (`../`, `/`).
  return `${tenantId}/${encodeURIComponent(slug)}.html`;
}

/**
 * Upload HTML for a published page to R2. Throws on failure — the caller
 * (triggerPublishedRender) treats a throw as "R2 write failed, do not
 * proceed to OS write, log loudly, leave R2 at prior version."
 */
export async function uploadPublishedHtmlToR2(
  tenantId: number,
  slug: string,
  html: string,
): Promise<void> {
  const cfg = getR2Config();
  if (!cfg) {
    throw new Error("R2 not configured (missing R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_BUCKET)");
  }
  await cfg.client.send(
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: r2KeyFor(tenantId, slug),
      Body: Buffer.from(html, "utf8"),
      ContentType: "text/html; charset=utf-8",
      // Tenant ID metadata for human auditing (`wrangler r2 object info` etc).
      // Not used for access control.
      Metadata: {
        "tenant-id": String(tenantId),
        "rendered-at": new Date().toISOString(),
      },
    }),
  );
}

/**
 * Read R2 HTML. Returns null on 404 (object not yet mirrored / deleted).
 * Throws on transient failures so callers can distinguish "definitely
 * absent" from "couldn't tell." Only used by the api-server backfill /
 * reconciliation tooling; the visitor path reads from R2 via the CF
 * worker binding.
 */
export async function readPublishedHtmlFromR2(
  tenantId: number,
  slug: string,
): Promise<{ html: string; lastModified: Date | null } | null> {
  const cfg = getR2Config();
  if (!cfg) return null;
  try {
    const out = await cfg.client.send(
      new GetObjectCommand({ Bucket: cfg.bucket, Key: r2KeyFor(tenantId, slug) }),
    );
    const body = await out.Body?.transformToString("utf-8");
    return {
      html: body ?? "",
      lastModified: out.LastModified ?? null,
    };
  } catch (err) {
    if (err instanceof NoSuchKey || err instanceof NotFound) return null;
    // The SDK can also throw a generic error with name === "NoSuchKey" depending on transport.
    if (err && typeof err === "object" && "name" in err && (err as { name: string }).name === "NoSuchKey") return null;
    throw err;
  }
}

/** Lightweight existence check (no body download). */
export async function publishedHtmlExistsInR2(
  tenantId: number,
  slug: string,
): Promise<boolean> {
  const cfg = getR2Config();
  if (!cfg) return false;
  try {
    await cfg.client.send(
      new HeadObjectCommand({ Bucket: cfg.bucket, Key: r2KeyFor(tenantId, slug) }),
    );
    return true;
  } catch (err) {
    if (err instanceof NotFound) return false;
    if (err && typeof err === "object" && "name" in err) {
      const n = (err as { name: string }).name;
      if (n === "NotFound" || n === "NoSuchKey") return false;
    }
    throw err;
  }
}

/**
 * Delete an object. Per the consistency model, deletes go R2-first
 * (visitor-facing) then OS (debug). Throws on failure so the caller
 * decides whether to proceed to the OS delete.
 */
export async function deletePublishedHtmlFromR2(
  tenantId: number,
  slug: string,
): Promise<void> {
  const cfg = getR2Config();
  if (!cfg) return;
  await cfg.client.send(
    new DeleteObjectCommand({ Bucket: cfg.bucket, Key: r2KeyFor(tenantId, slug) }),
  );
}
