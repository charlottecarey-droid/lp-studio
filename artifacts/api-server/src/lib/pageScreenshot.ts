/**
 * Self-hosted page screenshot — the replacement for the thum.io capture path.
 *
 * Why not thum.io: it renders the page in a third-party headless browser on a
 * time-based wait, so it routinely snapshots BEFORE the brand webfonts finish
 * their `font-display: swap` (the "wrong fonts" captures), caches that bad
 * frame keyed on the URL, caps resolution on the anonymous tier, and makes the
 * stored "image" a live dependency on someone else's renderer.
 *
 * This helper drives the SAME chromium the publish prerender already uses
 * (lib/prerenderLpPage.ts) and returns raw PNG bytes the caller can validate,
 * resize, and upload to object storage — so the stored URL is ours forever.
 *
 * Correctness guarantees the thum.io flow could not make:
 *   - waits for the viewer's real content marker ([data-lp-page] with children,
 *     same condition as the prerender) instead of a fixed sleep;
 *   - awaits `document.fonts.ready`, so self-hosted faces (Dandy's Bagoss) and
 *     Google-hosted brand fonts are painted before the shot;
 *   - proxies fonts.googleapis.com / fonts.gstatic.com requests through Node's
 *     own fetch — the api-server demonstrably reaches gstatic in the deployment
 *     (routes/sales/brand-font.ts), so even if the chromium subprocess's egress
 *     is filtered (the prerender's QUIET_HOSTS note) the fonts still load;
 *   - gives in-viewport images a bounded window to finish decoding.
 *
 * Callers pass a fully-formed URL — normally the SPA `/preview/:slug` route
 * with `?reviewToken=…&prerender=1` so drafts/templates render and the viewer
 * takes the StaticRenderContext path (scroll-reveal content visible, the same
 * contract the HTML prerender relies on).
 */
import { makeSemaphore, envConcurrency } from "./semaphore";
import { detectSystemChromium } from "./prerenderLpPage";

/** Chromium instances are heavy; captures queue rather than pile up. */
const screenshotSemaphore = makeSemaphore({
  name: "page-screenshot",
  max: envConcurrency("PAGE_SCREENSHOT_CONCURRENCY", 1),
});

/** Hosts whose requests are fulfilled via Node fetch (webfont safety net). */
const FONT_PROXY_HOSTS = new Set(["fonts.googleapis.com", "fonts.gstatic.com"]);

export interface PageScreenshotOptions {
  /** Fully-formed target URL (caller appends reviewToken/prerender params). */
  url: string;
  /** Browser viewport = the captured frame (the screenshot is viewport-sized). */
  viewportWidth: number;
  viewportHeight: number;
  /** Device pixel ratio. 1 (default) captures at exactly viewport pixels. */
  deviceScaleFactor?: number;
  /** Hard timeout for launch + nav + waits. Default 60s. */
  timeoutMs?: number;
  /**
   * CSS selector that marks "the page is pixel-final" — used INSTEAD of the
   * default `[data-lp-page]`-with-children condition. The designed OG card
   * route sets `[data-og-card-ready="1"]` only after it has explicitly loaded
   * its fonts + background image and run its text auto-fit, which is a
   * stronger guarantee than the generic waits below.
   */
  readyWaitSelector?: string;
}

export async function capturePageScreenshot(opts: PageScreenshotOptions): Promise<Buffer> {
  return screenshotSemaphore.run(() => captureNow(opts));
}

async function captureNow(opts: PageScreenshotOptions): Promise<Buffer> {
  const timeoutMs = opts.timeoutMs ?? 60_000;
  // Dynamic import so the playwright cost isn't paid at api-server boot.
  const { chromium } = await import("playwright");
  const executablePath = detectSystemChromium();

  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });
  try {
    const context = await browser.newContext({
      viewport: { width: opts.viewportWidth, height: opts.viewportHeight },
      deviceScaleFactor: opts.deviceScaleFactor ?? 1,
      extraHTTPHeaders: { "x-lp-prerender": "1" },
    });
    context.setDefaultTimeout(timeoutMs);

    // Webfont safety net — see the header comment. On any proxy failure the
    // request falls back to chromium's own network path.
    await context.route(
      (u) => FONT_PROXY_HOSTS.has(u.hostname),
      async (route) => {
        try {
          const req = route.request();
          const resp = await fetch(req.url(), {
            headers: { "user-agent": req.headers()["user-agent"] ?? "Mozilla/5.0" },
          });
          if (!resp.ok) {
            await route.continue();
            return;
          }
          const body = Buffer.from(await resp.arrayBuffer());
          await route.fulfill({
            status: resp.status,
            headers: {
              "content-type": resp.headers.get("content-type") ?? "application/octet-stream",
              "access-control-allow-origin": "*",
            },
            body,
          });
        } catch {
          await route.continue().catch(() => {});
        }
      },
    );

    const page = await context.newPage();
    const response = await page.goto(opts.url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    if (!response || !response.ok()) {
      throw new Error(`screenshot target failed to load (${response?.status() ?? "no-response"}): ${opts.url}`);
    }

    if (opts.readyWaitSelector) {
      // The target page declares its own readiness (see the option's doc).
      await page.waitForSelector(opts.readyWaitSelector, {
        state: "attached",
        timeout: Math.max(30_000, Math.floor(timeoutMs * 0.75)),
      });
    } else {
      // Same "the viewer actually rendered blocks" condition as the prerender —
      // never snapshot the boot spinner or an auth-loading shell.
      await page.waitForFunction(
        // Browser-context callback (typed `any` — the api-server tsconfig has no
        // DOM lib; Playwright runs this inside chromium where `document` is real).
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
          return !!lpPage && lpPage.children?.length > 0;
        }) as unknown as string,
        { timeout: Math.max(30_000, Math.floor(timeoutMs * 0.75)) },
      );
    }

    // The load-bearing wait thum.io couldn't do: every @font-face used on the
    // page (self-hosted Bagoss included) has finished loading. Bounded so a
    // hung font request can't stall the capture.
    await page
      .evaluate(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ((): any => {
          const doc = (globalThis as any).document;
          if (!doc?.fonts?.ready) return true;
          return Promise.race([
            doc.fonts.ready.then(() => true),
            new Promise((resolve) => setTimeout(() => resolve(true), 8000)),
          ]);
        }) as unknown as string,
      )
      .catch(() => {});

    // Bounded settle for in-viewport images (lazy off-screen images never
    // load under a static viewport, so only count the visible ones).
    await page
      .waitForFunction(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ((): any => {
          const g = globalThis as any;
          const doc = g.document;
          const vh = g.innerHeight ?? 0;
          const imgs = Array.from(doc?.images ?? []) as Array<{
            complete: boolean;
            getBoundingClientRect: () => { top: number; bottom: number };
          }>;
          return imgs
            .filter((img) => {
              const r = img.getBoundingClientRect();
              return r.bottom > 0 && r.top < vh;
            })
            .every((img) => img.complete);
        }) as unknown as string,
        { timeout: 5_000 },
      )
      .catch(() => {});
    await page.waitForTimeout(400);

    const buffer = await page.screenshot({ type: "png" });
    await context.close();
    return buffer;
  } finally {
    await browser.close().catch(() => {});
  }
}
