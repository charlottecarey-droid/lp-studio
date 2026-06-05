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
  ListObjectsV2Command,
  NoSuchKey,
  NotFound,
} from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { Agent as HttpsAgent } from "node:https";
import { RENDER_VERSION_META_KEY } from "./renderVersion";

/** Default socket pool for the on-demand client (publish-path writes, the
 *  request-serving reads). Large enough to absorb a publish burst. */
export const R2_DEFAULT_MAX_SOCKETS = 200;

/** Smaller pool for the background sweeps (asset health check, GC,
 *  snapshot reconcile, publish-time presence check). They run on timers,
 *  not the user's critical path, so they get a bounded slice of the
 *  connection budget — on-demand work (e.g. microsite generation, publish)
 *  must never be starved by a sweep fanning out hundreds of HEADs. */
export const R2_SWEEP_MAX_SOCKETS = 25;

/** Fail-fast timeout (ms) for acquiring + establishing a socket. When the
 *  agent's pool is saturated, a queued request never sees a `socket` event,
 *  so this connection timeout fires and rejects with a TimeoutError instead
 *  of enqueuing indefinitely (the old behavior produced the
 *  `socket usage at capacity=200 and 666 additional requests are enqueued`
 *  pile-up and an edge-timeout 500 with no origin completion log). Reused
 *  keep-alive sockets clear this immediately, so it only bites genuine
 *  saturation. */
const R2_CONNECTION_TIMEOUT_MS = 6_000;

/** Overall per-request ceiling (ms). With `throwOnRequestTimeout` this turns
 *  a stuck in-flight R2 call into a prompt, logged error rather than a hang
 *  that the Cloudflare edge eventually times out. R2 objects here are small
 *  (prerendered HTML, asset HEADs), so 30s is generous headroom. */
const R2_REQUEST_TIMEOUT_MS = 30_000;

/**
 * Build an R2-targeted S3 client with a bounded, fail-fast socket pool.
 *
 * Every R2 client in this service MUST be created through here.
 * @smithy/node-http-handler otherwise falls back to Node's global
 * https.Agent (`maxSockets` ~50). The periodic asset health-check / GC
 * sweeps blow past that on a cold start — we observed
 * `socket usage at capacity=50 and 590 additional requests are enqueued`
 * in prod, which back-pressured uploads and starved the event loop during
 * the deploy startup probe. Keep-alive also lets the burst of small
 * PUT/HEAD/GET calls a publish or sweep triggers reuse TLS handshakes.
 *
 * Fail-fast on saturation (task: microsite-generation 500 RCA): without a
 * socket-acquisition timeout a saturated pool enqueues requests forever, so
 * an on-demand request that needs R2 hangs until the edge times out (500
 * with no origin completion log). `connectionTimeout` bounds the
 * socket-acquisition+connect wait and `requestTimeout` (with
 * `throwOnRequestTimeout`) bounds the overall call, so a saturated or stuck
 * pool produces a prompt, catchable error instead.
 *
 * `maxSockets` defaults to the large on-demand budget; background sweeps
 * pass `R2_SWEEP_MAX_SOCKETS` so they get a small, bounded slice and can't
 * monopolize the connection budget.
 */
export function buildR2S3Client(opts: {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  maxSockets?: number;
}): S3Client {
  const httpsAgent = new HttpsAgent({
    maxSockets: opts.maxSockets ?? R2_DEFAULT_MAX_SOCKETS,
    keepAlive: true,
  });
  return new S3Client({
    region: "auto",
    // R2 S3-compatible endpoint. Per CF docs:
    //   https://<ACCOUNT_ID>.r2.cloudflarestorage.com
    endpoint: `https://${opts.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: opts.accessKeyId,
      secretAccessKey: opts.secretAccessKey,
    },
    // R2 doesn't support some S3 features; force path-style addressing
    // to avoid SDK trying to do virtual-host-style with a non-AWS host.
    forcePathStyle: true,
    // Bound retries so a stuck endpoint can't multiply each failed call into
    // several more queued attempts on an already-saturated pool.
    maxAttempts: 3,
    requestHandler: new NodeHttpHandler({
      httpsAgent,
      connectionTimeout: R2_CONNECTION_TIMEOUT_MS,
      requestTimeout: R2_REQUEST_TIMEOUT_MS,
      throwOnRequestTimeout: true,
    }),
  });
}

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
    cachedClient = buildR2S3Client({ accountId, accessKeyId, secretAccessKey });
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

/**
 * R2 object key layout (task #364, per-host revision).
 *
 * Key = `<host>/<encodeURIComponent(slug)>.html`
 *
 * Rationale (read the architectural note in worker.js too): keying by
 * host instead of tenant ID lets the CF worker resolve a request to an
 * R2 key using ONLY the request's Host header — no api-server call, no
 * tenant lookup, no cache to keep warm. The whole point of R2 mirroring
 * is to survive api-server outages; an api-server-dependent tenant
 * lookup in the read path would defeat that.
 *
 * Cost: one R2 PUT per host the tenant owns per publish (typically 1-4).
 *
 * Bonus correctness win: the rendered HTML carries host-specific
 * canonical/og:url tags, so per-host storage is also semantically
 * correct for multi-host tenants — not just a workaround.
 *
 * `host` is normalized (lowercase, port stripped) at this boundary so
 * callers don't have to think about it.
 */
function normalizeHostForKey(host: string): string {
  return host.split(":")[0].trim().toLowerCase();
}

function r2KeyFor(host: string, slug: string): string {
  const h = normalizeHostForKey(host);
  // Slug is URL-safe per schema validation; encode defensively against
  // path-traversal (`../`, `/`). Host is encoded for the same reason —
  // hostnames don't legally contain `/` but defense in depth.
  return `${encodeURIComponent(h)}/${encodeURIComponent(slug)}.html`;
}

/**
 * Upload HTML for a published page to R2 under the given host. Throws
 * on failure — the caller (triggerPublishedRender) treats a throw as
 * "R2 write failed, do not proceed to OS write, log loudly, leave R2
 * at prior version."
 *
 * For multi-host tenants, call once per host with the per-host HTML
 * (canonical URL inside the HTML matches the key's host).
 */
export async function uploadPublishedHtmlToR2(
  host: string,
  slug: string,
  html: string,
  meta?: { tenantId?: number; robots?: string | null; renderVersion?: string },
): Promise<void> {
  const cfg = getR2Config();
  if (!cfg) {
    throw new Error("R2 not configured (missing R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_BUCKET)");
  }
  await cfg.client.send(
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: r2KeyFor(host, slug),
      Body: Buffer.from(html, "utf8"),
      ContentType: "text/html; charset=utf-8",
      // Human-auditing metadata (`wrangler r2 object info`). Not access control.
      // `x-robots` (task #547) IS load-bearing: the CF worker reads it from
      // the object's customMetadata and emits it as the `X-Robots-Tag` response
      // header so the prerendered HTML carries the noindex directive in BOTH
      // the <meta> tag and the header. Omitted when fully allowed (no header).
      //
      // `render-version` (task #708) records which lp-studio render-schema
      // version baked this snapshot, so the post-deploy reconcile
      // (snapshotReconcile.ts) can detect snapshots left behind by a
      // rendering fix and re-bake them — without re-rendering to inspect
      // the HTML. Read back via `getPublishedHtmlMetaFromR2`.
      Metadata: {
        ...(meta?.tenantId !== undefined ? { "tenant-id": String(meta.tenantId) } : {}),
        ...(meta?.robots ? { "x-robots": meta.robots } : {}),
        ...(meta?.renderVersion ? { [RENDER_VERSION_META_KEY]: meta.renderVersion } : {}),
        host: normalizeHostForKey(host),
        "rendered-at": new Date().toISOString(),
      },
    }),
  );
}

/**
 * HEAD an R2 snapshot and return its auditing metadata without downloading
 * the body. Returns null when the object doesn't exist (404). Throws on
 * transient failures so callers can distinguish "definitely absent" from
 * "couldn't tell."
 *
 * Used by the post-deploy snapshot reconcile (task #708) to read each
 * snapshot's stored `render-version` cheaply. S3/R2 lowercases user
 * metadata keys on read, so we look up `RENDER_VERSION_META_KEY` (already
 * lowercase) directly.
 */
export async function getPublishedHtmlMetaFromR2(
  host: string,
  slug: string,
): Promise<{ renderVersion: string | null; lastModified: Date | null } | null> {
  const cfg = getR2Config();
  if (!cfg) return null;
  try {
    const out = await cfg.client.send(
      new HeadObjectCommand({ Bucket: cfg.bucket, Key: r2KeyFor(host, slug) }),
    );
    const md = out.Metadata ?? {};
    return {
      renderVersion: md[RENDER_VERSION_META_KEY] ?? null,
      lastModified: out.LastModified ?? null,
    };
  } catch (err) {
    if (err instanceof NotFound) return null;
    if (err && typeof err === "object" && "name" in err) {
      const n = (err as { name: string }).name;
      if (n === "NotFound" || n === "NoSuchKey") return null;
    }
    throw err;
  }
}

/**
 * Read R2 HTML. Returns null on 404 (object not yet mirrored / deleted).
 * Throws on transient failures so callers can distinguish "definitely
 * absent" from "couldn't tell." Only used by the api-server backfill /
 * reconciliation tooling; the visitor path reads from R2 via the CF
 * worker binding.
 */
export async function readPublishedHtmlFromR2(
  host: string,
  slug: string,
): Promise<{ html: string; lastModified: Date | null } | null> {
  const cfg = getR2Config();
  if (!cfg) return null;
  try {
    const out = await cfg.client.send(
      new GetObjectCommand({ Bucket: cfg.bucket, Key: r2KeyFor(host, slug) }),
    );
    const body = await out.Body?.transformToString("utf-8");
    return {
      html: body ?? "",
      lastModified: out.LastModified ?? null,
    };
  } catch (err) {
    if (err instanceof NoSuchKey || err instanceof NotFound) return null;
    if (err && typeof err === "object" && "name" in err && (err as { name: string }).name === "NoSuchKey") return null;
    throw err;
  }
}

/** Lightweight existence check (no body download). */
export async function publishedHtmlExistsInR2(
  host: string,
  slug: string,
): Promise<boolean> {
  const cfg = getR2Config();
  if (!cfg) return false;
  try {
    await cfg.client.send(
      new HeadObjectCommand({ Bucket: cfg.bucket, Key: r2KeyFor(host, slug) }),
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
 * List object keys in the bucket. Used by debugging / inventory tools
 * (scripts/list-r2-objects.ts) and by future reconciliation jobs
 * (e.g. orphan-host cleanup). Handles pagination automatically — CF R2
 * caps ListObjectsV2 at 1000 keys per call.
 *
 * `prefix` is optional and is matched server-side. To list everything
 * under a specific host, pass `${encodeURIComponent(host)}/`.
 *
 * Returns the raw stored keys (already URL-encoded). Use
 * `decodeURIComponent` on each segment to recover the human-readable
 * host/slug pair.
 *
 * Returns null when R2 isn't configured so the caller can warn cleanly
 * instead of crashing on a missing-secret development setup.
 */
export async function listR2Objects(
  prefix?: string,
): Promise<{ key: string; size: number; lastModified: Date | null }[] | null> {
  const cfg = getR2Config();
  if (!cfg) return null;
  const out: { key: string; size: number; lastModified: Date | null }[] = [];
  let continuationToken: string | undefined;
  // Hard page-count cap as a safety net: 100 pages × 1000 = 100k keys.
  // The bucket is expected to hold ~ (#published pages) × (#hosts per
  // tenant); blowing past this means something is very wrong (orphan
  // accumulation, accidental write loop) and we'd rather fail fast.
  for (let page = 0; page < 100; page++) {
    const res = await cfg.client.send(
      new ListObjectsV2Command({
        Bucket: cfg.bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );
    for (const obj of res.Contents ?? []) {
      if (!obj.Key) continue;
      out.push({
        key: obj.Key,
        size: obj.Size ?? 0,
        lastModified: obj.LastModified ?? null,
      });
    }
    if (!res.IsTruncated) return out;
    continuationToken = res.NextContinuationToken;
  }
  throw new Error(
    `listR2Objects: hit 100-page safety cap (>100000 keys). Bucket may need cleanup.`,
  );
}

/**
 * Delete an object. Per the consistency model, deletes go R2-first
 * (visitor-facing) then OS (debug). Throws on failure so the caller
 * decides whether to proceed to the OS delete.
 */
export async function deletePublishedHtmlFromR2(
  host: string,
  slug: string,
): Promise<void> {
  const cfg = getR2Config();
  if (!cfg) return;
  await cfg.client.send(
    new DeleteObjectCommand({ Bucket: cfg.bucket, Key: r2KeyFor(host, slug) }),
  );
}
