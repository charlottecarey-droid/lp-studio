/**
 * Capture a real screenshot thumbnail for a template (an `lp_pages` row with
 * is_template = true) and persist it on `lp_pages.thumbnail_url`.
 *
 * Task #736 introduced this via the public thum.io gateway; that produced
 * wrong-font/half-hydrated captures (thum.io snapshots on a fixed wait in its
 * own headless browser and caches the bad frame), so captures now run through
 * the SELF-HOSTED chromium screenshot helper (lib/pageScreenshot.ts — waits
 * for the viewer's content marker + `document.fonts.ready`) and the PNG is
 * uploaded to object storage. The stored thumbnail_url is our own
 * `/api/storage/objects/uploads/<id>` serve path — a stable image with no
 * third-party renderer behind it.
 *
 * Targets the in-app `/preview/:slug` route — which renders unpublished
 * pages/templates as a full SPA — authenticated by a short-lived (pending,
 * revocable) review token minted exactly like the prerender flow, plus
 * `&prerender=1` so the viewer takes the StaticRenderContext path and
 * scroll-reveal content is visible in the shot.
 *
 * On any failure thumbnail_url is left as-is (or cleared when requested) so
 * the card falls back to the page's OG image and a later save retries.
 */
import { db, lpPagesTable, lpPageReviewsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { capturePageScreenshot } from "./pageScreenshot";
import { ObjectStorageService } from "./objectStorage";

/**
 * Template card aspect — a 3:2 crop, wider + taller than the 1200x630 OG card.
 *
 * High-DPI sharpness: gallery cards are ~410px wide at the 3-up grid and up to
 * ~430px full-width on phones, i.e. up to ~1290 device px on a 3× display. The
 * stored image is 1280×853 (the browser always *downscales*, never upscales),
 * captured from a 1600-wide desktop viewport so templates render their
 * intended desktop layout.
 */
const THUMB_VIEWPORT_WIDTH = 1600;
const THUMB_VIEWPORT_HEIGHT = 1067;
const THUMB_OUT_WIDTH = 1280;
const THUMB_OUT_HEIGHT = 853;

/**
 * Minimum per-channel standard deviation for a capture to count as a real,
 * fully-rendered screenshot. A blank white/grey page — or a half-rendered shell
 * that never hydrated — is near-uniform (stdev ≈ 0); a real template (hero
 * imagery, colored sections, text) is well above this. Captures below the
 * threshold are rejected so we never persist a broken screenshot over a good OG
 * image.
 */
const MIN_CONTENT_STDEV = 10;

/** Hard ceiling on one capture (browser launch + nav + waits + shot). */
const CAPTURE_TIMEOUT_MS = 60_000;

/** Default coalescing window for fire-and-forget captures after autosaves. */
const DEFAULT_DEBOUNCE_MS = 30_000;

const storage = new ObjectStorageService();

export interface CaptureThumbnailOptions {
  pageId: number;
  /**
   * Host the triggering request arrived on. Used to build a `/preview/:slug`
   * URL on a host that serves the lp-studio SPA (the admin host always does).
   * Omitted by the backfill script, which falls back to env-configured hosts.
   */
  requestHost?: string | null;
  /**
   * When true, a failed/blank capture actively clears any stored thumbnail_url
   * (set NULL) so the card falls back to the page's OG image. The manual-refresh
   * route sets this so a previously-stored broken capture reverts to OG.
   * The fire-and-forget autosave path leaves the existing thumbnail intact to
   * avoid a mid-edit flicker to the gradient on a transient failure.
   */
  clearOnFailure?: boolean;
}

/**
 * `captured`  — a fresh, validated screenshot was stored on thumbnail_url.
 * `fell_back` — no real screenshot (blank/grey/timeout/error); the card should
 *               show the page's OG image. thumbnail_url left as-is, or cleared
 *               to NULL when `clearOnFailure` was requested.
 * `skipped`   — the row isn't a capturable template (missing/not-template/no-slug).
 */
export type CaptureOutcome = "captured" | "fell_back" | "skipped";

export interface CaptureThumbnailResult {
  ok: boolean;
  outcome: CaptureOutcome;
  thumbnailUrl: string | null;
  thumbnailCapturedAt: Date | null;
  /** True when a stored thumbnail_url was actively set NULL on failure. */
  cleared?: boolean;
  skipped?: "page_not_found" | "not_template" | "no_slug";
  error?: string;
}

/**
 * Resolve a base URL that serves the lp-studio SPA `/preview/:slug` route.
 * Prefer the triggering admin host (guaranteed to serve the SPA + be reachable
 * from this process), then the explicit render-base override, then the dev
 * domain, then any configured public host.
 *
 * Exported for the OG capture route, which builds the same preview URL.
 */
export function resolvePreviewBaseUrl(requestHost?: string | null): string {
  const host = (requestHost ?? "").trim().toLowerCase();
  if (host) {
    const proto = host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https";
    return `${proto}://${host}`;
  }
  const override = process.env.LP_STUDIO_RENDER_BASE_URL;
  if (override) return override.replace(/\/$/, "");
  const dev = (process.env.REPLIT_DEV_DOMAIN || "").trim().toLowerCase();
  if (dev) return `https://${dev}`;
  const pub = (process.env.LP_STUDIO_PUBLIC_HOST || "").trim().toLowerCase();
  if (pub) return `https://${pub}`;
  return "http://127.0.0.1:3000";
}

/**
 * Mint (or reuse) a pending review token for the page so the headless capture
 * can read the draft/template via `/api/lp/preview/:slug?reviewToken=`.
 * Mirrors prerenderLpPage.ts::ensureReviewToken (reuse the latest pending
 * token to avoid piling up rows on every re-capture).
 *
 * Exported for the OG capture route.
 */
export async function ensurePreviewReviewToken(pageId: number): Promise<string> {
  const [existing] = await db
    .select({ token: lpPageReviewsTable.token })
    .from(lpPageReviewsTable)
    .where(and(eq(lpPageReviewsTable.pageId, pageId), eq(lpPageReviewsTable.status, "pending")))
    .orderBy(desc(lpPageReviewsTable.createdAt))
    .limit(1);
  if (existing?.token) return existing.token;
  const fresh = randomBytes(24).toString("hex");
  const [inserted] = await db
    .insert(lpPageReviewsTable)
    .values({ pageId, token: fresh, status: "pending" })
    .returning({ token: lpPageReviewsTable.token });
  return inserted?.token ?? fresh;
}

/** `/api/storage/objects/uploads/<id>` → `/objects/uploads/<id>` (the path the
 *  storage service understands), or null for anything else — external URLs and
 *  legacy thum.io links are simply not ours to delete. Exported for tests. */
export function storedObjectPathFromServeUrl(url: string | null | undefined): string | null {
  if (!url || !url.startsWith("/api/storage/objects/")) return null;
  return url.slice("/api/storage".length);
}

/** Reject blank/grey/near-uniform captures (the SPA never hydrated) so a
 *  broken screenshot can never override a perfectly good OG image.
 *  Exported for the OG capture route, which applies the same gate. */
export async function isNearUniformCapture(imageBytes: Buffer): Promise<{ blank: boolean; stdev: string }> {
  const stats = await sharp(imageBytes).stats();
  const maxStdev = Math.max(...stats.channels.map((c) => c.stdev));
  const blank = !Number.isFinite(maxStdev) || maxStdev < MIN_CONTENT_STDEV;
  return { blank, stdev: Number.isFinite(maxStdev) ? maxStdev.toFixed(1) : "n/a" };
}

/**
 * Capture + persist a thumbnail for one template. Best-effort: returns a
 * structured result instead of throwing so callers (fire-and-forget triggers
 * and the manual-refresh route) can decide what to surface.
 */
export async function captureTemplateThumbnail(
  opts: CaptureThumbnailOptions,
): Promise<CaptureThumbnailResult> {
  const skip = (
    skipped: NonNullable<CaptureThumbnailResult["skipped"]>,
  ): CaptureThumbnailResult => ({
    ok: false,
    outcome: "skipped",
    thumbnailUrl: null,
    thumbnailCapturedAt: null,
    skipped,
  });

  const [page] = await db
    .select({
      id: lpPagesTable.id,
      slug: lpPagesTable.slug,
      isTemplate: lpPagesTable.isTemplate,
      thumbnailUrl: lpPagesTable.thumbnailUrl,
    })
    .from(lpPagesTable)
    .where(eq(lpPagesTable.id, opts.pageId));
  if (!page) return skip("page_not_found");
  if (!page.isTemplate) return skip("not_template");
  const slug = (page.slug ?? "").trim();
  if (!slug) return skip("no_slug");

  // A capture didn't yield a real screenshot. Optionally clear any stored
  // thumbnail so the card falls back to the page's OG image, then report a
  // structured "fell_back" outcome the caller can surface honestly.
  const fellBack = async (error?: string): Promise<CaptureThumbnailResult> => {
    let cleared = false;
    if (opts.clearOnFailure) {
      try {
        await db
          .update(lpPagesTable)
          .set({ thumbnailUrl: null, thumbnailCapturedAt: null })
          .where(eq(lpPagesTable.id, page.id));
        cleared = true;
      } catch (err) {
        console.warn("[captureTemplateThumbnail] failed to clear thumbnail", {
          pageId: page.id,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return {
      ok: false,
      outcome: "fell_back",
      thumbnailUrl: null,
      thumbnailCapturedAt: null,
      cleared,
      error,
    };
  };

  const capturedAt = new Date();
  let imageBytes: Buffer;
  try {
    const token = await ensurePreviewReviewToken(page.id);
    const baseUrl = resolvePreviewBaseUrl(opts.requestHost);
    const previewUrl =
      `${baseUrl}/preview/${encodeURIComponent(slug)}` +
      `?reviewToken=${encodeURIComponent(token)}&prerender=1`;
    imageBytes = await capturePageScreenshot({
      url: previewUrl,
      viewportWidth: THUMB_VIEWPORT_WIDTH,
      viewportHeight: THUMB_VIEWPORT_HEIGHT,
      timeoutMs: CAPTURE_TIMEOUT_MS,
    });
  } catch (err) {
    return fellBack(err instanceof Error ? err.message : String(err));
  }

  let thumbnailUrl: string;
  try {
    const { blank, stdev } = await isNearUniformCapture(imageBytes);
    if (blank) return fellBack(`blank/near-uniform capture (max stdev ${stdev})`);
    const resized = await sharp(imageBytes)
      .resize({ width: THUMB_OUT_WIDTH, height: THUMB_OUT_HEIGHT, fit: "cover", position: "centre" })
      .png()
      .toBuffer();
    const servePath = await storage.uploadObjectEntity(resized, "image/png");
    thumbnailUrl = `/api/storage${servePath}`;
  } catch (err) {
    return fellBack(
      `could not process capture: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  try {
    await db
      .update(lpPagesTable)
      .set({ thumbnailUrl, thumbnailCapturedAt: capturedAt })
      .where(eq(lpPagesTable.id, page.id));
  } catch (err) {
    return fellBack(err instanceof Error ? err.message : String(err));
  }

  // Reclaim the previous capture's stored object — best-effort, never fails
  // the refresh. Legacy thum.io URLs (external) return null and are skipped.
  const oldObjectPath = storedObjectPathFromServeUrl(page.thumbnailUrl);
  if (oldObjectPath) {
    void storage.deleteObjectEntity(oldObjectPath).catch((err) => {
      console.warn("[captureTemplateThumbnail] failed to delete previous thumbnail object", {
        pageId: page.id,
        err: err instanceof Error ? err.message : String(err),
      });
    });
  }

  return { ok: true, outcome: "captured", thumbnailUrl, thumbnailCapturedAt: capturedAt };
}

// Per-page debounce timers so rapid autosaves coalesce into a single capture.
const debounceTimers = new Map<number, ReturnType<typeof setTimeout>>();

/**
 * Fire-and-forget, debounced thumbnail capture. Never throws to the caller —
 * safe to call inline from a save/publish handler without awaiting. Repeated
 * calls for the same pageId within the debounce window collapse to one run.
 */
export function triggerTemplateThumbnailCapture(
  opts: CaptureThumbnailOptions & { debounceMs?: number },
): void {
  const debounceMs = opts.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const existing = debounceTimers.get(opts.pageId);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    debounceTimers.delete(opts.pageId);
    void captureTemplateThumbnail(opts).catch((err) => {
      console.warn("[captureTemplateThumbnail] uncaught", { pageId: opts.pageId, err });
    });
  }, debounceMs);
  // Don't keep the process alive for a background capture.
  if (typeof timer.unref === "function") timer.unref();
  debounceTimers.set(opts.pageId, timer);
}
