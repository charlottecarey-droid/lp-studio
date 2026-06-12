import dns from "dns/promises";
import net from "net";
import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db, lpMediaTable } from "@workspace/db";
import { ObjectStorageService } from "../objectStorage";
import { USER_AGENT } from "./types";
import { logger } from "../logger";
import { readImageDimensions } from "../imageDimensions";
import { autoTagImage } from "../imageAutoTag";

const objectStorage = new ObjectStorageService();

// Per-asset caps. Brand logos are tiny (SVG/PNG, almost always under
// 200KB) and hero photos rarely exceed 2MB in their CDN-optimized form;
// 5MB is comfortable headroom that still rejects pathological assets
// (4k JPEGs, raw PSDs, animated GIFs from blog footers).
const MAX_BYTES = 5 * 1024 * 1024;
// Per-asset fetch timeout. Raised from 4s to 10s (task #592): origin-
// fetched ecommerce CDN images (uncached Shopify/Cloudinary derivatives,
// signed-URL hero photos) regularly take 4-8s on the first hit, and the
// old 4s cap was silently dropping them, leaving lp_media empty. The
// photo fan-out is parallel and capped at MAX_PHOTOS, so the worst-case
// wall-time cost is a single slow asset (~10s), not N×timeout.
const FETCH_TIMEOUT_MS = 10_000;

// Max photo assets to mirror. The photography extractor returns up to 8
// reference URLs; we cap at 6 here to leave budget headroom inside the
// orchestrator's post-extractor mirror step (each fetch+upload runs
// 200ms-1500ms, so 6 fits in ~5s in the worst case and ~1s typical).
const MAX_PHOTOS = 6;

interface MirrorInputs {
  tenantId: number;
  brandName: string;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  photoUrls?: string[];
}

export interface MirrorOutput {
  /** Rewritten logo URL pointing at the freshly-uploaded /api/storage
   *  asset, or `undefined` if the upload failed (caller should keep the
   *  external URL in that case). */
  logoUrl?: string;
  /** Rewritten favicon URL pointing at the freshly-uploaded /api/storage
   *  asset, or `undefined` if the upload failed (caller keeps the external
   *  URL in that case). */
  faviconUrl?: string;
  /** Rewritten photo URLs, in the same order as the input (failures are
   *  dropped, not replaced with their external original — the goal is a
   *  clean library, not a 1:1 mapping). */
  photoUrls: string[];
  /** Number of assets attempted vs uploaded — surfaced in logs for
   *  debugging slow / hostile CDNs. */
  attempted: number;
  uploaded: number;
  /** Per-asset skip reasons (`"<url> -> <reason>"`), surfaced in logs so
   *  an all-skipped run (lp_media stays empty) is debuggable instead of
   *  silent. */
  skips: string[];
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function extToMime(url: string): string | null {
  const path = url.toLowerCase().split("?")[0];
  if (path.endsWith(".svg") || path.endsWith(".svgz")) return "image/svg+xml";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".gif")) return "image/gif";
  if (path.endsWith(".avif")) return "image/avif";
  return null;
}

export interface FetchedAsset {
  buffer: Buffer;
  mimeType: string;
  sourceUrl: string;
}

// SSRF guard mirroring the one in brand-import-from-url-stream.ts:
// scraped sites are untrusted, so each asset URL (and every redirect
// hop) must point at a public IP before we issue the GET. Without this
// a hostile page could supply `https://attacker.example/redirect ->
// http://169.254.169.254/...` and exfiltrate cloud-metadata responses
// into the tenant's media library as "image/*" blobs.
function isPrivateOrReservedIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    if (parts.length !== 4 || parts.some((p) => isNaN(p))) return true;
    const [a, b] = parts;
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === "::" || lower === "::1") return true;
    if (lower.startsWith("fe80:") || lower.startsWith("fe80::")) return true;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
    if (lower.startsWith("ff")) return true;
    if (lower.startsWith("::ffff:")) {
      const v4 = lower.slice(7);
      if (net.isIPv4(v4)) return isPrivateOrReservedIp(v4);
    }
    return false;
  }
  return true;
}

async function isSafePublicHost(hostname: string): Promise<boolean> {
  if (!hostname) return false;
  if (hostname === "localhost") return false;
  try {
    const records = await dns.lookup(hostname, { all: true });
    if (!records.length) return false;
    return records.every((r) => !isPrivateOrReservedIp(r.address));
  } catch {
    return false;
  }
}

const MAX_REDIRECTS = 3;

/**
 * Decode the Playwright logo worker's `data:image/svg+xml;base64,…`
 * URLs so we can upload the bytes the same way as a fetched asset.
 * Other data URL flavors (raster `data:image/png;base64,…`) are also
 * accepted for completeness; non-image data URLs are rejected.
 */
function decodeDataUrl(url: string): FetchedAsset | null {
  const m = url.match(/^data:([^;,]+)(;base64)?,(.+)$/);
  if (!m) return null;
  const mime = m[1].toLowerCase();
  if (!mime.startsWith("image/")) return null;
  const isBase64 = !!m[2];
  const payload = m[3];
  try {
    const buffer = isBase64 ? Buffer.from(payload, "base64") : Buffer.from(decodeURIComponent(payload), "utf8");
    if (!buffer.length || buffer.length > MAX_BYTES) return null;
    return { buffer, mimeType: mime, sourceUrl: url };
  } catch {
    return null;
  }
}

/**
 * Fetch a remote image with a tight timeout, size cap, and content-type
 * guardrail. Returns null on any failure — callers treat per-asset
 * failures as silent skips, not orchestrator-level errors, so a single
 * 403 from a hotlink-protected CDN doesn't poison the rest of the run.
 *
 * Redirects are followed manually so we can re-validate each hop's host
 * against the SSRF allow-list (the WHATWG fetch's `redirect: "follow"`
 * blindly chases Location headers, which would defeat a public-host
 * check on the original URL).
 */
/** Discriminated fetch result so callers can log *why* an asset was
 *  skipped instead of treating every failure as an opaque `null`. */
export type FetchResult =
  | { ok: true; asset: FetchedAsset }
  | { ok: false; reason: string };

/** Exported for reuse by scripts/retag-media-library.ts (backfilling content
 *  tags onto old rows whose `url` is still an external http(s)/data URL needs
 *  the same SSRF-guarded, size-capped fetch the mirror uses). */
export async function fetchAsset(url: string): Promise<FetchResult> {
  if (url.startsWith("data:")) {
    const decoded = decodeDataUrl(url);
    return decoded ? { ok: true, asset: decoded } : { ok: false, reason: "invalid-data-url" };
  }

  let current = url;
  let originalUrl = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let parsed: URL;
    try {
      parsed = new URL(current);
    } catch {
      return { ok: false, reason: "invalid-url" };
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { ok: false, reason: `bad-protocol:${parsed.protocol}` };
    }
    if (!(await isSafePublicHost(parsed.hostname))) {
      return { ok: false, reason: "unsafe-host" };
    }

    let res: Response;
    try {
      res = await fetch(current, {
        headers: { "User-Agent": USER_AGENT, "Accept": "image/*,*/*;q=0.8" },
        redirect: "manual",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch (e) {
      const aborted = e instanceof Error && e.name === "TimeoutError";
      return { ok: false, reason: aborted ? `timeout:${FETCH_TIMEOUT_MS}ms` : `fetch-error:${String(e)}` };
    }

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return { ok: false, reason: `redirect-no-location:${res.status}` };
      // Resolve relative redirects against the previous hop's URL.
      try {
        current = new URL(loc, current).toString();
      } catch {
        return { ok: false, reason: "bad-redirect-location" };
      }
      continue;
    }

    if (!res.ok) return { ok: false, reason: `http-${res.status}` };
    const ct = res.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
    const mimeType = (ct && ct.startsWith("image/")) ? ct : extToMime(current);
    if (!mimeType) return { ok: false, reason: `non-image-content-type:${ct ?? "none"}` };
    const len = res.headers.get("content-length");
    if (len && Number(len) > MAX_BYTES) return { ok: false, reason: `too-large:${len}` };
    try {
      const buffer = Buffer.from(await res.arrayBuffer());
      if (!buffer.length) return { ok: false, reason: "empty-body" };
      if (buffer.length > MAX_BYTES) return { ok: false, reason: `too-large:${buffer.length}` };
      return { ok: true, asset: { buffer, mimeType, sourceUrl: originalUrl } };
    } catch {
      return { ok: false, reason: "body-read-error" };
    }
  }
  return { ok: false, reason: "too-many-redirects" };
}

interface UploadOpts {
  tenantId: number;
  tags: string[];
  title: string;
}

interface UploadedRecord {
  id: number;
  url: string;
  width: number | null;
  height: number | null;
}

async function uploadAndRecord(asset: FetchedAsset, opts: UploadOpts): Promise<UploadedRecord | null> {
  try {
    // Pass tenantId so the stored object carries a tenant-owner ACL —
    // the /api/storage serve route refuses cross-tenant reads for any
    // object with that policy, matching how the rest of lp_media assets
    // are protected.
    const servePath = await objectStorage.uploadObjectEntity(asset.buffer, asset.mimeType, { tenantId: opts.tenantId });
    const serveUrl = `/api/storage${servePath}`;
    // Capture intrinsic pixel dimensions so the AI page generator can refuse
    // undersized scraped images as full-bleed hero backgrounds (task #1065).
    const dims = await readImageDimensions(asset.buffer, asset.mimeType);
    const [inserted] = await db.insert(lpMediaTable).values({
      tenantId: opts.tenantId,
      title: opts.title,
      url: serveUrl,
      mediaType: "image",
      mimeType: asset.mimeType,
      sizeBytes: asset.buffer.length,
      width: dims?.width ?? null,
      height: dims?.height ?? null,
      tags: opts.tags,
    }).returning({ id: lpMediaTable.id });
    if (!inserted) return null;
    return { id: inserted.id, url: serveUrl, width: dims?.width ?? null, height: dims?.height ?? null };
  } catch {
    return null;
  }
}

/** True when the GPT-4o vision tagger has credentials configured. Mirrors the
 *  guard inside autoTagImage so the mirror can warn ONCE (and skip the awaited
 *  tagging) rather than awaiting N no-op calls. */
function imageTaggerConfigured(): boolean {
  return !!process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"] && !!process.env["AI_INTEGRATIONS_OPENAI_API_KEY"];
}

/** Upper bound on how long we wait for a single image's vision tagging before
 *  giving up and keeping provenance-only tags. Keeps the brand-import / generate
 *  path responsive if the tagger is slow or hanging. */
const AUTO_TAG_TIMEOUT_MS = 25_000;

/** Content/purpose auto-tagging for a freshly mirrored image, AWAITED by the
 *  mirror so the immediately-following page generation sees real content +
 *  purpose tags (lp-hero / lp-feature / product-detail) instead of provenance-
 *  only tags. Reuses the same GPT-4o vision tagger the media-drawer upload path
 *  uses. Never throws into the caller and is bounded by AUTO_TAG_TIMEOUT_MS —
 *  on failure / timeout / missing key the image simply keeps its provenance
 *  tags. Existing provenance tags (page-reference / scraped / refhost: /
 *  refsrc:) are preserved by autoTagImage (it strips only stale purpose/og tags
 *  before merging). */
function runAutoTag(
  rec: UploadedRecord,
  asset: FetchedAsset,
  tags: string[],
  opts: { forbidHeroPurpose?: boolean } = {},
): Promise<void> {
  // Cleared the instant tagging settles so a fast success/failure never leaves a
  // live timer that fires a spurious "timed out" warning ~25s later.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const tagging = autoTagImage(rec.id, asset.buffer, asset.mimeType, tags, opts)
    .catch((err) => {
      logger.warn(
        { mediaId: rec.id, err: String(err) },
        "[page-reference] auto-tag failed — image keeps provenance-only tags",
      );
    })
    .finally(() => {
      if (timer) clearTimeout(timer);
    });
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(() => {
      logger.warn({ mediaId: rec.id }, "[page-reference] auto-tag timed out — image keeps provenance-only tags");
      resolve();
    }, AUTO_TAG_TIMEOUT_MS);
    if (typeof timer.unref === "function") timer.unref();
  });
  return Promise.race([tagging, timeout]);
}

function titleFromUrl(url: string, fallback: string): string {
  try {
    if (url.startsWith("data:")) return fallback;
    const path = new URL(url).pathname;
    const base = path.split("/").filter(Boolean).pop() ?? "";
    const trimmed = base.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
    return trimmed || fallback;
  } catch {
    return fallback;
  }
}

/**
 * Re-host the homepage screenshot captured during evidence build into the
 * tenant's object storage and return a `/api/storage/...` URL. Unlike logos
 * and photography this does NOT create an `lp_media` row — the screenshot is
 * a brand-settings preview asset (a visual record of what the source site
 * looked like at import time), not a reusable media-library image, so keeping
 * it out of the picker avoids cluttering the library. Accepts the inlined
 * `data:image/...;base64,...` URL (the firecrawl-hosted screenshot URL is
 * short-lived, so we only ever mirror from the bytes we already fetched).
 * Best-effort: returns null on any failure so the import still succeeds.
 */
export async function mirrorHomepageScreenshot(inputs: {
  tenantId: number;
  dataUrl: string;
}): Promise<string | null> {
  const fetched = await fetchAsset(inputs.dataUrl);
  if (!fetched.ok) {
    logger.warn(
      { tenantId: inputs.tenantId, reason: fetched.reason },
      "[brand-import] homepage screenshot mirror skipped",
    );
    return null;
  }
  try {
    const servePath = await objectStorage.uploadObjectEntity(
      fetched.asset.buffer,
      fetched.asset.mimeType,
      { tenantId: inputs.tenantId },
    );
    return `/api/storage${servePath}`;
  } catch (err) {
    logger.warn(
      { tenantId: inputs.tenantId, err: String(err) },
      "[brand-import] homepage screenshot upload failed",
    );
    return null;
  }
}

/**
 * Download the importer's chosen logo + photography reference images
 * and re-host them as tenant-scoped `lp_media` rows. Returns rewritten
 * `/api/storage/...` URLs so the orchestrator can swap them into the
 * proposed BrandConfig before the FE applies anything. Best-effort:
 * per-asset failures are silent skips, never orchestrator errors —
 * worst case the caller keeps the external URL it already had.
 *
 * Why this exists: external links from scraped sites (especially CDN
 * hero photos and inline-SVG-converted logos) break frequently due to
 * hotlink protection, signed-URL expiry, and bot blocking. Mirroring
 * to the tenant's own media library makes them durable and lets the
 * Media Library picker surface them alongside everything else the
 * tenant has uploaded.
 */
export async function mirrorBrandAssets(inputs: MirrorInputs): Promise<MirrorOutput> {
  const brandSlug = slugify(inputs.brandName || "brand-import") || "brand-import";
  const baseTags = ["brand-import", brandSlug];
  const out: MirrorOutput = { photoUrls: [], attempted: 0, uploaded: 0, skips: [] };

  // Logo first — sequential so its failure surfaces in logs before we
  // start the photo fan-out. Logos are small (often <50KB) so the
  // sequential cost is negligible.
  if (inputs.logoUrl) {
    out.attempted++;
    const fetched = await fetchAsset(inputs.logoUrl);
    if (fetched.ok) {
      const rec = await uploadAndRecord(fetched.asset, {
        tenantId: inputs.tenantId,
        tags: [...baseTags, "logo"],
        title: `${inputs.brandName || "Brand"} logo`,
      });
      if (rec) {
        out.logoUrl = rec.url;
        out.uploaded++;
      } else {
        out.skips.push(`${inputs.logoUrl} -> upload-failed`);
      }
    } else {
      out.skips.push(`${inputs.logoUrl} -> ${fetched.reason}`);
    }
  }

  // Favicon next — sequential like the logo (tiny .ico/.png, negligible
  // cost). Mirroring rather than storing the external URL keeps the tenant's
  // browser-tab icon durable against the source site removing/renaming its
  // favicon, and tenant-owns the asset behind the /api/storage ACL.
  if (inputs.faviconUrl) {
    out.attempted++;
    const fetched = await fetchAsset(inputs.faviconUrl);
    if (fetched.ok) {
      const rec = await uploadAndRecord(fetched.asset, {
        tenantId: inputs.tenantId,
        tags: [...baseTags, "favicon"],
        title: `${inputs.brandName || "Brand"} favicon`,
      });
      if (rec) {
        out.faviconUrl = rec.url;
        out.uploaded++;
      } else {
        out.skips.push(`${inputs.faviconUrl} -> upload-failed`);
      }
    } else {
      out.skips.push(`${inputs.faviconUrl} -> ${fetched.reason}`);
    }
  }

  // Photos in parallel — independent network calls, no shared state.
  const photos = (inputs.photoUrls ?? []).slice(0, MAX_PHOTOS);
  out.attempted += photos.length;
  const results = await Promise.all(photos.map(async (sourceUrl, i) => {
    const fetched = await fetchAsset(sourceUrl);
    if (!fetched.ok) return { sourceUrl, url: null as string | null, reason: fetched.reason };
    const photoTags = [...baseTags, "photography"];
    const rec = await uploadAndRecord(fetched.asset, {
      tenantId: inputs.tenantId,
      tags: photoTags,
      title: titleFromUrl(sourceUrl, `${inputs.brandName || "Brand"} photo ${i + 1}`),
    });
    // Best-effort, non-blocking: enrich brand-import photos with real content +
    // purpose tags so future generations can place them relevantly. Unlike the
    // reference-mirror path, the brand-asset import isn't immediately followed by
    // a generation from these photos, so it stays fire-and-forget (bounded +
    // never throws via runAutoTag).
    // Same source-page hero rule as the reference mirror: photoUrls arrive in
    // document order (collectImagesFromDom content[]), so only the first photo
    // is hero-eligible; later photos are forbidden the lp-hero purpose.
    if (rec && imageTaggerConfigured()) void runAutoTag(rec, fetched.asset, photoTags, { forbidHeroPurpose: i !== 0 });
    return { sourceUrl, url: rec?.url ?? null, reason: rec ? null : "upload-failed" };
  }));
  for (const r of results) {
    if (r.url) {
      out.photoUrls.push(r.url);
      out.uploaded++;
    } else {
      out.skips.push(`${r.sourceUrl} -> ${r.reason ?? "unknown"}`);
    }
  }
  if (out.skips.length) {
    logger.warn(
      { tenantId: inputs.tenantId, brandName: inputs.brandName, skips: out.skips },
      "[brand-import] mirrorBrandAssets skipped assets",
    );
  }
  return out;
}

// ── Page-create reference-image harvest (task #747) ─────────────────────────
//
// At page-create time we scrape the reference URL for its real content images
// and mirror them into the tenant's media library so the generator can use
// genuine site photos before falling back to AI generation. This is a sibling
// of mirrorBrandAssets but with its own tagging + de-dup so repeated
// generations from one site don't pile up duplicate rows.

// Cap distinct from MAX_PHOTOS. Raised 6 -> 12 (task #1146): image-poor brands
// (the Dandy SMB case) yield very few *distinct* usable photos per page, so the
// generator runs out of on-brand imagery and falls back to neutral/AI fillers
// for the remaining slots. The multi-page reference scrape already aggregates
// candidates across the homepage + companion pages (deduped), so a higher cap
// here lets more of those genuinely-distinct images reach the fill pool instead
// of being truncated. The fan-out stays bounded and parallel, and the harvest
// runs concurrently with the (multi-second) LLM call rather than on the blocking
// path, so the extra slots add no perceptible latency. Dedup is unaffected:
// near-duplicate variants are still folded by `imageIdentity` at selection time.
const MAX_REFERENCE_PHOTOS = 12;

/** A mirrored library image, structurally compatible with the generator's
 *  in-memory MediaImage so it can be appended straight into the fill pool. */
export interface MirroredImage {
  url: string;
  title: string;
  tags: string[];
  /** Intrinsic pixel dimensions captured at mirror time, or null when sharp
   *  could not size the asset. Lets the generator's hero-resolution guard
   *  judge a scraped image without re-fetching it (task #1065). */
  width?: number | null;
  height?: number | null;
}

export interface MirrorReferenceOutput {
  /** Freshly uploaded `/api/storage/...` library images (excludes de-duped /
   *  failed candidates). */
  images: MirroredImage[];
  attempted: number;
  uploaded: number;
  /** Candidates skipped because they were already mirrored for this tenant
   *  from the same source (de-dup). */
  skipped: number;
  /** Per-asset fetch/upload skip reasons, surfaced in logs. */
  skips: string[];
}

/** Stable content-addressed tag for a source image URL, so we can detect
 *  whether this tenant already mirrored it on a prior generation. */
function referenceSrcTag(normalizedUrl: string): string {
  return `refsrc:${createHash("sha1").update(normalizedUrl).digest("hex").slice(0, 16)}`;
}

function normalizeForDedup(u: string): string {
  try {
    const url = new URL(u);
    url.hash = "";
    return url.toString();
  } catch {
    return u;
  }
}

/** Replace a stale "lp-hero" purpose tag with "lp-feature" (deduped), preserving
 *  every other tag. Used to correct a scraped row that was mirrored before the
 *  source-page hero rule existed when it is reused on a later generation. */
function downgradeHeroPurpose(tags: string[]): string[] {
  const out: string[] = [];
  let hasFeature = false;
  for (const t of tags) {
    if (t.toLowerCase() === "lp-hero") continue;
    if (t.toLowerCase() === "lp-feature") hasFeature = true;
    out.push(t);
  }
  if (!hasFeature) out.push("lp-feature");
  return out;
}

/**
 * Mirror the reference site's content images into the tenant's media library.
 * Tags each row `["page-reference", "scraped", "refhost:<host>", "refsrc:<hash>"]`
 * so they're identifiable and de-dupable. Best-effort throughout: a dedup-query
 * failure just risks a few duplicate rows, and per-asset fetch failures are
 * silent skips — never thrown — so a slow/hostile CDN can't fail generation.
 */
export async function mirrorReferenceImages(inputs: {
  tenantId: number;
  sourceUrl: string;
  imageUrls: string[];
}): Promise<MirrorReferenceOutput> {
  const out: MirrorReferenceOutput = { images: [], attempted: 0, uploaded: 0, skipped: 0, skips: [] };

  let refHost = "";
  try {
    refHost = new URL(inputs.sourceUrl).hostname.replace(/^www\./, "");
  } catch {
    refHost = "";
  }

  // Normalize + de-dup candidate URLs within this request.
  const candidates: { sourceUrl: string; tag: string }[] = [];
  const seenTags = new Set<string>();
  for (const raw of inputs.imageUrls) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const tag = referenceSrcTag(normalizeForDedup(trimmed));
    if (seenTags.has(tag)) continue;
    seenTags.add(tag);
    candidates.push({ sourceUrl: trimmed, tag });
  }
  if (candidates.length === 0) return out;

  // A scraped image may only earn "lp-hero" if it was the actual hero on the
  // source page. collectImagesFromDom returns content images in document order
  // (chrome / logos / icons / sub-200px assets already excluded), so the FIRST
  // candidate is the page's hero region; every later candidate (team headshots,
  // mid-page lifestyle/product shots) is forbidden the hero purpose.
  const heroTag = candidates[0]?.tag;

  // De-dup across prior page-create harvests for this tenant: map each refsrc
  // tag already present on a "scraped" row to that existing library row. We
  // skip re-uploading those sources, but we still RETURN their existing rows
  // (below) so a repeat generation from the same URL surfaces this run's
  // reference imagery with the same priority as a fresh mirror — otherwise the
  // second generation would get an empty `images[]` and silently fall back to
  // generic catalog photos.
  const alreadyMirrored = new Map<string, MirroredImage>();
  const idByTag = new Map<string, number>();
  try {
    const existing = await db
      .select({
        id: lpMediaTable.id,
        url: lpMediaTable.url,
        title: lpMediaTable.title,
        tags: lpMediaTable.tags,
        width: lpMediaTable.width,
        height: lpMediaTable.height,
      })
      .from(lpMediaTable)
      .where(and(
        eq(lpMediaTable.tenantId, inputs.tenantId),
        eq(lpMediaTable.mediaType, "image"),
        sql`${lpMediaTable.tags} @> ${JSON.stringify(["scraped"])}::jsonb`,
      ))
      .limit(2000);
    for (const row of existing) {
      const tags = (row.tags as string[]) ?? [];
      for (const t of tags) {
        if (typeof t === "string" && t.startsWith("refsrc:") && !alreadyMirrored.has(t)) {
          alreadyMirrored.set(t, {
            url: row.url,
            title: row.title ?? "",
            tags,
            width: row.width,
            height: row.height,
          });
          idByTag.set(t, row.id);
        }
      }
    }
  } catch (e) {
    logger.warn(
      { tenantId: inputs.tenantId, refHost, err: String(e) },
      "[page-reference] dedup query failed — may re-mirror some images",
    );
  }

  const fresh = candidates.filter((c) => !alreadyMirrored.has(c.tag));
  out.skipped = candidates.length - fresh.length;

  // Surface the existing library rows for any deduped candidate so the caller
  // gets this URL's reference images on every generation, not just the first.
  // Capped at MAX_REFERENCE_PHOTOS to match the fresh-upload path — a content
  // page can expose dozens of images, and an oversized reference pool would
  // skew the generator's selection.
  // Rows mirrored before the source-page hero rule may still carry "lp-hero"
  // even though they were NOT the page hero. Strip it from non-hero deduped rows
  // on reuse (downgrade to lp-feature) and persist, so already-scraped imagery
  // also obeys the rule — including the Dandy hero pool, which hard-filters on
  // the lp-hero tag and would otherwise keep surfacing a stale mis-tagged shot.
  const heroDowngrades: { id: number; tags: string[] }[] = [];
  for (const c of candidates) {
    if (out.images.length >= MAX_REFERENCE_PHOTOS) break;
    const existingImg = alreadyMirrored.get(c.tag);
    if (!existingImg) continue;
    if (c.tag !== heroTag && existingImg.tags.some((t) => t.toLowerCase() === "lp-hero")) {
      const correctedTags = downgradeHeroPurpose(existingImg.tags);
      const id = idByTag.get(c.tag);
      if (typeof id === "number") heroDowngrades.push({ id, tags: correctedTags });
      out.images.push({ ...existingImg, tags: correctedTags });
    } else {
      out.images.push(existingImg);
    }
  }
  if (heroDowngrades.length > 0) {
    await Promise.all(
      heroDowngrades.map(async (d) => {
        try {
          await db.update(lpMediaTable).set({ tags: d.tags }).where(eq(lpMediaTable.id, d.id));
        } catch (e) {
          logger.warn(
            { tenantId: inputs.tenantId, mediaId: d.id, err: String(e) },
            "[page-reference] stale lp-hero downgrade failed — row keeps its tags",
          );
        }
      }),
    );
  }

  const toMirror = fresh.slice(0, MAX_REFERENCE_PHOTOS);
  out.attempted = toMirror.length;
  if (toMirror.length === 0) return out;

  const baseTags = ["page-reference", "scraped", ...(refHost ? [`refhost:${refHost}`] : [])];

  // Enrich scraped reference images with real content + purpose tags BEFORE the
  // mirror returns, so the page generation that follows this import can place
  // them by relevance/purpose instead of via the relaxed provenance-only gate.
  // If the tagger isn't configured we warn once and keep provenance-only tags
  // (the generation still works, just with weaker placement).
  const taggerOn = imageTaggerConfigured();
  if (!taggerOn) {
    logger.warn(
      { tenantId: inputs.tenantId, refHost },
      "[page-reference] image tagger not configured (AI_INTEGRATIONS_OPENAI_* missing) — scraped images keep provenance-only tags",
    );
  }

  const results = await Promise.all(toMirror.map(async (c, i) => {
    const tags = [...baseTags, c.tag];
    const title = titleFromUrl(c.sourceUrl, `${refHost || "Reference"} image ${i + 1}`);
    const fetched = await fetchAsset(c.sourceUrl);
    if (!fetched.ok) {
      return { rec: null as UploadedRecord | null, reason: fetched.reason, sourceUrl: c.sourceUrl, tags, title };
    }
    const rec = await uploadAndRecord(fetched.asset, { tenantId: inputs.tenantId, tags, title });
    // Awaited (bounded) so this run's generation sees the richer tags. Never
    // throws — on failure/timeout the image keeps its provenance-only tags.
    if (rec && taggerOn) await runAutoTag(rec, fetched.asset, tags, { forbidHeroPurpose: c.tag !== heroTag });
    return { rec, reason: rec ? null : "upload-failed", sourceUrl: c.sourceUrl, tags, title };
  }));

  for (const r of results) {
    if (r.rec) {
      out.images.push({ url: r.rec.url, title: r.title, tags: r.tags, width: r.rec.width, height: r.rec.height });
      out.uploaded++;
    } else {
      out.skips.push(`${r.sourceUrl} -> ${r.reason ?? "unknown"}`);
    }
  }

  if (out.skips.length) {
    logger.warn(
      { tenantId: inputs.tenantId, refHost, skips: out.skips },
      "[page-reference] mirrorReferenceImages skipped assets",
    );
  }
  return out;
}
