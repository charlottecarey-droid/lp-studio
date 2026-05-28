/**
 * Render a published landing page to static HTML via Playwright (Chromium).
 *
 * Drives the running lp-studio service from inside the API server, captures
 * the hydrated DOM, and post-processes the result so the file on disk has
 * exact per-page <title>/<meta>/OG tags from lp_pages columns regardless
 * of what the SPA's `usePageMeta` hook did during the snapshot.
 *
 * Why Playwright (not server-side renderToString):
 *   - lp-studio's ~150 blocks include scroll-driven and `window`-aware
 *     components (BlockForm reads localStorage in render; BlockSpatialTour
 *     mounts pointer/scroll listeners; many headers read scroll position).
 *     Patching all of them for SSR-safety is a separate, multi-day audit.
 *   - The api-server is a separate workspace package and can't import
 *     lp-studio's `.tsx` blocks directly without a cross-workspace SSR
 *     build (vite ssr entry, externalized deps, etc.) — also multi-day.
 *   - Marketing-site prerender (task #363) already proved Playwright on
 *     this NixOS container; reusing the pattern is additive.
 *
 * Cost: 3–10 s per publish. Acceptable for a flow that runs at most once
 * per publish/unpublish/edit, not per visitor.
 *
 * Snapshot target: GET ${baseUrl}/preview/${slug}?reviewToken=${token}.
 * The /preview route is public-with-token (lp/index.ts allowlist) and
 * mounts LandingPageViewer with the page's hydrated config — exactly what
 * a published visitor sees, without any session-bound chrome.
 *
 * Task #364.
 */
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { db, lpPageReviewsTable, lpPagesTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

/**
 * Thrown when the lp_pages row backing a prerender job no longer exists
 * (deleted between trigger and worker run, or the trigger was queued for
 * the wrong tenant). Callers should treat this as a non-retriable skip
 * — neither the page row nor any FK-bound child row can be recovered by
 * retrying. Task #389.
 */
export class PrerenderPageMissingError extends Error {
  readonly code = "page_missing" as const;
  readonly pageId: number;
  readonly tenantId: number | null;
  constructor(pageId: number, tenantId: number | null, detail: string) {
    super(`prerender page_missing pageId=${pageId}${tenantId !== null ? ` tenantId=${tenantId}` : ""}: ${detail}`);
    this.name = "PrerenderPageMissingError";
    this.pageId = pageId;
    this.tenantId = tenantId;
  }
}

// Postgres FK-violation code, raised when an insert into lp_page_reviews
// references an lp_pages row that no longer exists.
const PG_FK_VIOLATION = "23503";
function isFkViolation(err: unknown): boolean {
  return !!(err && typeof err === "object" && "code" in err && (err as { code?: unknown }).code === PG_FK_VIOLATION);
}

let cachedChromium: string | null | undefined;

/** Reuse the marketing-prerender chromium-detection dance (see #363). */
function detectSystemChromium(): string | undefined {
  if (cachedChromium !== undefined) return cachedChromium ?? undefined;
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    cachedChromium = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
    return cachedChromium;
  }
  for (const name of ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"]) {
    try {
      const out = execSync(`command -v ${name} 2>/dev/null`, { encoding: "utf8" }).trim();
      if (out && existsSync(out)) {
        cachedChromium = out;
        return out;
      }
    } catch {
      /* keep looking */
    }
  }
  cachedChromium = null;
  return undefined;
}

/**
 * Base URL of the running lp-studio service. In Replit dev the api-server
 * and lp-studio share REPLIT_DEV_DOMAIN via the path-based proxy
 * (lp-studio at `/`, api-server at `/api`). In production we expect an
 * explicit override via env var so we can render against the canonical
 * tenant host (so client-side host-based logic in the SPA, like
 * tenant resolution, matches what visitors will see).
 */
function resolveLpStudioBaseUrl(): string {
  const override = process.env.LP_STUDIO_RENDER_BASE_URL;
  if (override) return override.replace(/\/$/, "");
  const dev = process.env.REPLIT_DEV_DOMAIN;
  if (dev) return `https://${dev}`;
  // Last-ditch fallback for purely local dev. Real publishes will fail
  // here (no preview service) and surface a logged warning to the caller.
  return "http://127.0.0.1:3000";
}

/**
 * Mint (or reuse) a review token for a page so the preview endpoint
 * authenticates the snapshot request without a logged-in session. Reusing
 * the most recent pending token avoids piling up rows on every re-publish.
 *
 * Task #389: the prerender worker runs asynchronously after the publish
 * handler returns, which leaves a window where the page can be deleted
 * (or never existed under this tenant — e.g. a queued job for the wrong
 * tenant) before this insert fires. Without a guard, drizzle surfaces a
 * raw `lp_page_reviews_page_id_lp_pages_id_fk` violation that the outer
 * caller miscategorises as `nav_or_timeout`. We re-fetch the page row
 * (tenant-scoped when known) and throw a typed `PrerenderPageMissingError`
 * so the caller can record a structured skip instead of retrying a
 * doomed insert.
 */
async function ensureReviewToken(pageId: number, tenantId: number | null): Promise<string> {
  // Tenant-scoped existence check. If a tenantId is supplied (always the
  // case when called from triggerPublishedRender) we require the row to
  // belong to that tenant — this is the second half of the task #389
  // tenant-misrouting safety net.
  const pageRow = await db
    .select({ id: lpPagesTable.id })
    .from(lpPagesTable)
    .where(
      tenantId !== null
        ? and(eq(lpPagesTable.id, pageId), eq(lpPagesTable.tenantId, tenantId))
        : eq(lpPagesTable.id, pageId),
    )
    .limit(1);
  if (pageRow.length === 0) {
    throw new PrerenderPageMissingError(
      pageId,
      tenantId,
      tenantId !== null
        ? "lp_pages row missing for this tenant at review-token time"
        : "lp_pages row missing at review-token time",
    );
  }

  const [existing] = await db
    .select({ token: lpPageReviewsTable.token })
    .from(lpPageReviewsTable)
    .where(and(eq(lpPageReviewsTable.pageId, pageId), eq(lpPageReviewsTable.status, "pending")))
    .orderBy(desc(lpPageReviewsTable.createdAt))
    .limit(1);
  if (existing?.token) return existing.token;
  const fresh = randomBytes(24).toString("hex");
  try {
    const [inserted] = await db
      .insert(lpPageReviewsTable)
      .values({ pageId, token: fresh, status: "pending" })
      .returning({ token: lpPageReviewsTable.token });
    return inserted?.token ?? fresh;
  } catch (err) {
    // Race: the page existed at the SELECT above but was deleted before
    // the INSERT committed. Convert to the typed skip so the outer
    // caller doesn't fire `prerender_render_failed` with a generic
    // nav_or_timeout reason.
    if (isFkViolation(err)) {
      throw new PrerenderPageMissingError(
        pageId,
        tenantId,
        "lp_page_reviews FK violation — lp_pages row deleted between check and insert",
      );
    }
    throw err;
  }
}

export interface PrerenderOptions {
  /** lp_pages.id — used to mint the review token. */
  pageId: number;
  /**
   * Tenant id the job was queued for. When supplied, the review-token
   * insert verifies the lp_pages row belongs to this tenant — guards
   * against tenant-misrouted jobs (task #389).
   */
  tenantId?: number | null;
  /** lp_pages.slug — used to build the preview URL. */
  slug: string;
  /** Override the snapshot base URL; defaults to the resolved lp-studio host. */
  baseUrlOverride?: string;
  /** Hard timeout for the whole render (browser launch + nav + settle). */
  timeoutMs?: number;
}

/**
 * Render a single page and return the raw HTML the headless browser saw.
 * Caller is responsible for any meta post-processing + storage upload.
 *
 * Throws on hard failures (browser launch, navigation 4xx/5xx, mount
 * timeout). Callers should treat this as best-effort and not let it fail
 * the upstream publish request — render-on-publish is fire-and-forget.
 */
export async function prerenderLpPage(opts: PrerenderOptions): Promise<string> {
  const timeoutMs = opts.timeoutMs ?? 90_000;
  // Sub-timeout for the wait-for-content phase specifically. Kept under the
  // overall timeoutMs so the navigation + settle still have headroom. Was
  // implicitly Playwright's 30s default before (task #364 follow-up): a
  // single chromium memory spike or slow page-hydration would blow through
  // 30s but easily finish under 60s, causing avoidable render_failed.
  const waitTimeoutMs = Math.max(60_000, Math.floor(timeoutMs * 0.75));
  const baseUrl = (opts.baseUrlOverride || resolveLpStudioBaseUrl()).replace(/\/$/, "");

  const token = await ensureReviewToken(opts.pageId, opts.tenantId ?? null);
  const url = `${baseUrl}/preview/${encodeURIComponent(opts.slug)}?reviewToken=${encodeURIComponent(token)}&prerender=1`;

  // Dynamic import so the playwright cost isn't paid by the api-server at
  // boot (it's only used on publish events, not on hot paths).
  const { chromium } = await import("playwright");
  const executablePath = detectSystemChromium();

  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      // Marker the SPA can pick up if it ever wants to skip side-effects
      // (analytics beacons, popup auto-open timers, etc.) during a render.
      extraHTTPHeaders: { "x-lp-prerender": "1" },
    });
    // Defensive: override Playwright's per-API 30s default so any
    // waitFor* / evaluate / content call without an explicit timeout
    // inherits our timeoutMs. Earlier we saw `waitForFunction Timeout
    // 30000ms exceeded` despite passing `{ timeout: timeoutMs }` — the
    // default still leaked through in at least one Playwright minor.
    context.setDefaultTimeout(timeoutMs);
    const page = await context.newPage();

    // Useful debug surface if a publish render starts failing in prod.
    page.on("pageerror", (err) => console.warn(`[prerender] pageerror ${opts.slug}:`, err.message));
    // Known-noisy third parties that consistently fail in the prerender
    // container's outbound network (egress allow-list does not cover
    // google fonts CDN or the cloudflare analytics beacon) but whose
    // failure is harmless for the snapshot — visitors load these
    // directly from the rendered HTML, not via the prerender. Silence
    // them so the real signal in the logs isn't drowned out.
    const QUIET_HOSTS = new Set([
      "fonts.gstatic.com",
      "fonts.googleapis.com",
      "static.cloudflareinsights.com",
      "cloudflareinsights.com",
    ]);
    const isQuietHost = (rawUrl: string): boolean => {
      try {
        const h = new URL(rawUrl).hostname;
        return QUIET_HOSTS.has(h) || h.endsWith(".cloudflareinsights.com");
      } catch {
        return false;
      }
    };
    page.on("requestfailed", (req) => {
      const f = req.failure();
      if (!f) return;
      if (isQuietHost(req.url())) return;
      console.warn(`[prerender] reqfail ${opts.slug}: ${req.url()} ${f.errorText}`);
    });

    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    if (!response || !response.ok()) {
      throw new Error(
        `prerender ${opts.slug} failed to load (${response?.status() ?? "no-response"}): ${url}`,
      );
    }

    // Wait for the LandingPageViewer to render real content. We can't just
    // check that `#root` has non-`pre-mount-loader` children — between the
    // pre-mount loader being removed and the LP blocks rendering, the SPA
    // shows an auth-loading spinner that satisfies a naive "has children"
    // check and would freeze a half-rendered snapshot (task #364 regression).
    // The viewer wraps the real page in a `[data-lp-page]` div with non-zero
    // child blocks, so we wait for that to appear with at least one child
    // (i.e. block content has mounted). Also require a non-empty title.
    await page.waitForFunction(
      // Browser-context callback (typed `any` because the api-server tsconfig
      // doesn't include the DOM lib — Playwright serialises the function and
      // runs it inside Chromium where `document` is real).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((): any => {
        const doc = (globalThis as any).document;
        const root = doc?.getElementById("root");
        if (!root) return false;
        const hasRealChildren = Array.from(root.children as ArrayLike<{ id?: string }>).some(
          (c) => c?.id !== "pre-mount-loader",
        );
        if (!hasRealChildren) return false;
        const lpPage = doc.querySelector?.("[data-lp-page]");
        if (!lpPage || lpPage.children?.length === 0) return false;
        return !!doc.title && doc.title.length > 0;
      }) as unknown as string,
      { timeout: waitTimeoutMs },
    );
    // Short settle for post-mount effects (font swap, image decode, lazy
    // children mounting after their parent fades in).
    await page.waitForTimeout(500);

    // ATOMIC capture: do the loader-strip, the prerendered marker, AND the
    // outerHTML snapshot inside a single evaluate, while also asserting
    // that [data-lp-page] is STILL present at snapshot time. This closes
    // the trios5-class race we saw in backfill: wait condition passed,
    // then between page.evaluate (strip loader) and the subsequent
    // page.content() the SPA re-rendered to a shell, capturing a doc with
    // no [data-lp-page] but stamped with data-prerendered="1" (worst of
    // both worlds — looks legitimate to runtime but is empty).
    // If the assertion fails, throw so the caller's retry kicks in
    // instead of writing a known-broken snapshot to R2.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const capture = await page.evaluate((): any => {
      const doc = (globalThis as any).document;
      const lp = doc.querySelector?.("[data-lp-page]");
      if (!lp || lp.children?.length === 0) {
        return { ok: false, reason: "lp-page-disappeared" };
      }
      doc.documentElement.setAttribute("data-prerendered", "1");
      const loader = doc.getElementById("pre-mount-loader");
      if (loader) loader.remove();
      return { ok: true, html: doc.documentElement.outerHTML as string };
    });
    if (!capture || !capture.ok) {
      throw new Error(
        `prerender ${opts.slug} snapshot race: ${capture?.reason ?? "unknown"} — [data-lp-page] missing at capture time despite passing the wait condition`,
      );
    }
    await context.close();
    return `<!DOCTYPE html>\n${capture.html.replace(/^<!DOCTYPE [^>]+>\s*/i, "")}`;
  } finally {
    await browser.close().catch(() => {});
  }
}
