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

/** Template card aspect — wider + taller crop than the 1200x630 OG card. */
const THUMB_WIDTH = 1200;
const THUMB_CROP = 800;

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
}

export interface CaptureThumbnailResult {
  ok: boolean;
  thumbnailUrl: string | null;
  thumbnailCapturedAt: Date | null;
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
  const fail = (
    partial: Partial<CaptureThumbnailResult>,
  ): CaptureThumbnailResult => ({
    ok: false,
    thumbnailUrl: null,
    thumbnailCapturedAt: null,
    ...partial,
  });

  const [page] = await db
    .select({ id: lpPagesTable.id, slug: lpPagesTable.slug, isTemplate: lpPagesTable.isTemplate })
    .from(lpPagesTable)
    .where(eq(lpPagesTable.id, opts.pageId));
  if (!page) return fail({ skipped: "page_not_found" });
  if (!page.isTemplate) return fail({ skipped: "not_template" });
  const slug = (page.slug ?? "").trim();
  if (!slug) return fail({ skipped: "no_slug" });

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
    return fail({ error: err instanceof Error ? err.message : String(err) });
  }

  // Pre-warm: trigger thum.io to render + cache the screenshot now.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PREWARM_TIMEOUT_MS);
  try {
    const res = await fetch(thumbnailUrl, { signal: controller.signal, redirect: "follow" });
    if (!res.ok) {
      return fail({ error: `thum.io responded ${res.status}` });
    }
    // Drain the body so the render completes before we record success.
    await res.arrayBuffer().catch(() => {});
  } catch (err) {
    return fail({ error: err instanceof Error ? err.message : String(err) });
  } finally {
    clearTimeout(timer);
  }

  try {
    await db
      .update(lpPagesTable)
      .set({ thumbnailUrl, thumbnailCapturedAt: capturedAt })
      .where(eq(lpPagesTable.id, page.id));
  } catch (err) {
    return fail({ error: err instanceof Error ? err.message : String(err) });
  }

  return { ok: true, thumbnailUrl, thumbnailCapturedAt: capturedAt };
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
