/**
 * Capture a real screenshot thumbnail for a template (an `lp_pages` row with
 * is_template = true) and persist it on `lp_pages.thumbnail_url`.
 *
 * Task #736. Reuses the same public thum.io gateway the OG flow uses
 * (artifacts/lp-studio .../BuilderEditor.tsx, `image.thum.io/get/...`) but
 * points it at the in-app `/preview/:slug` route — which renders unpublished
 * pages/templates as a full SPA snapshot — instead of `/p/:slug` (published
 * only, 404s on templates). A short-lived (non-expiring, revocable) review
 * token is minted exactly like the prerender flow (prerenderLpPage.ts) so
 * thum.io's headless fetch authenticates against `/api/lp/preview/:slug`
 * without a session.
 *
 * Storage model: the thum.io URL itself is the storage — we do NOT download or
 * re-host the image. We pre-warm the capture (a single GET) so thum.io renders
 * and caches the screenshot before the gallery `<img>` ever requests it. On
 * any failure we leave thumbnail_url NULL so the next save/edit/backfill run
 * retries it.
 *
 * Cache-busting: the captured target URL carries `&v=<capturedAt-ms>`. thum.io
 * keys its cache on the full target URL, so a re-capture (new timestamp) forces
 * a fresh render and the gallery — which renders the stored full thum.io URL —
 * loads the new image.
 */
import { db, lpPagesTable, lpPageReviewsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import sharp from "sharp";

/** Template card aspect — wider + taller crop than the 1200x630 OG card. */
const THUMB_WIDTH = 1200;
const THUMB_CROP = 800;

/**
 * Seconds thum.io waits *after* page load before snapshotting. The `/preview`
 * route is a client-rendered SPA (bundle boot → API fetch → block paint → brand
 * fonts/images), so without this thum.io often captures the blank/grey shell
 * before it hydrates. thum.io has no wait-for-selector option (only time-based
 * `wait`), so we give the SPA a generous fixed window and still validate the
 * result below.
 */
const THUMB_WAIT_SECONDS = 8;

/**
 * Minimum per-channel standard deviation for a capture to count as a real,
 * fully-rendered screenshot. A blank white/grey page — or a half-rendered shell
 * that never hydrated — is near-uniform (stdev ≈ 0); a real template (hero
 * imagery, colored sections, text) is well above this. Captures below the
 * threshold are rejected so we never persist a broken screenshot over a good OG
 * image.
 */
const MIN_CONTENT_STDEV = 10;

/**
 * Upper bound on the pre-warm GET. thum.io renders synchronously on first hit
 * (headless browser boot + nav + screenshot), which can take several seconds;
 * keep generous headroom but bounded so a stuck render can't hang the caller
 * (the manual-refresh route awaits this).
 */
const PREWARM_TIMEOUT_MS = 25_000;

/** Default coalescing window for fire-and-forget captures after autosaves. */
const DEFAULT_DEBOUNCE_MS = 30_000;

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
   * route sets this so a previously-stored broken grey capture reverts to OG.
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
 * Prefer the triggering admin host (guaranteed to serve the SPA + be publicly
 * reachable by thum.io), then the explicit render-base override, then the dev
 * domain, then any configured public host.
 */
function resolvePreviewBaseUrl(requestHost?: string | null): string {
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
 * Mint (or reuse) a pending review token for the page so thum.io's headless
 * fetch can read the draft/template via `/api/lp/preview/:slug?reviewToken=`.
 * Mirrors prerenderLpPage.ts::ensureReviewToken (reuse the latest pending
 * token to avoid piling up rows on every re-capture).
 */
async function ensureReviewToken(pageId: number): Promise<string> {
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

/**
 * Build the thum.io capture URL for a fully-formed preview URL. thum.io appends
 * the target URL raw after the option path (matching the existing OG pattern).
 */
export function buildTemplateThumbnailUrl(previewUrl: string): string {
  return `https://image.thum.io/get/width/${THUMB_WIDTH}/crop/${THUMB_CROP}/png/noanimate/${previewUrl}`;
}

/**
 * Capture + persist a thumbnail for one template. Best-effort: returns a
 * structured result instead of throwing so callers (fire-and-forget triggers
 * and the manual-refresh route) can decide what to surface. On failure
 * thumbnail_url is left NULL for a later retry.
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
    .select({ id: lpPagesTable.id, slug: lpPagesTable.slug, isTemplate: lpPagesTable.isTemplate })
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
  let thumbnailUrl: string;
  try {
    const token = await ensureReviewToken(page.id);
    const baseUrl = resolvePreviewBaseUrl(opts.requestHost);
    const previewUrl =
      `${baseUrl}/preview/${encodeURIComponent(slug)}` +
      `?reviewToken=${encodeURIComponent(token)}&v=${capturedAt.getTime()}`;
    thumbnailUrl = buildTemplateThumbnailUrl(previewUrl);
  } catch (err) {
    return fellBack(err instanceof Error ? err.message : String(err));
  }

  // Pre-warm: trigger thum.io to render the screenshot now, and pull the bytes
  // back so we can validate the capture before trusting it.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PREWARM_TIMEOUT_MS);
  let imageBytes: Buffer;
  try {
    const res = await fetch(thumbnailUrl, { signal: controller.signal, redirect: "follow" });
    if (!res.ok) {
      return fellBack(`thum.io responded ${res.status}`);
    }
    imageBytes = Buffer.from(await res.arrayBuffer());
  } catch (err) {
    return fellBack(err instanceof Error ? err.message : String(err));
  } finally {
    clearTimeout(timer);
  }

  // Validate: reject blank/grey/near-uniform captures (the SPA never hydrated)
  // so a broken screenshot can never override a perfectly good OG image.
  try {
    const stats = await sharp(imageBytes).stats();
    const maxStdev = Math.max(...stats.channels.map((c) => c.stdev));
    if (!Number.isFinite(maxStdev) || maxStdev < MIN_CONTENT_STDEV) {
      const reported = Number.isFinite(maxStdev) ? maxStdev.toFixed(1) : "n/a";
      return fellBack(`blank/near-uniform capture (max stdev ${reported})`);
    }
  } catch (err) {
    return fellBack(
      `could not decode capture: ${err instanceof Error ? err.message : String(err)}`,
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
