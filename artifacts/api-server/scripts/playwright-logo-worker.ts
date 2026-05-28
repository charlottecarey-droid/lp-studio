/**
 * Out-of-process Playwright logo fallback.
 *
 * The deterministic logo extractor (cheerio-only) misses inline-SVG header
 * logos that have no `alt`/`aria-label`/`<use href>` reference — Stripe and
 * Anthropic both render their wordmark as a path soup with no semantic
 * hooks, so cheerio sees nothing logo-shaped and falls back to favicon.
 *
 * This worker spins up a short-lived headless Chromium, navigates to the
 * URL, finds the largest SVG inside `<header>`/`<nav>` (or the largest
 * SVG above the fold whose container has a `logo`/`brand`/`wordmark`
 * class hint), serializes its outerHTML, and emits a JSON blob on stdout
 * containing a `data:image/svg+xml;base64,...` URL the parent can
 * surface as the brand logo.
 *
 * Strict process budget — the parent kills us after the budget elapses.
 * We additionally apply our own timeouts so we exit cleanly under normal
 * conditions and let the parent's kill be a backstop only.
 *
 * Usage:
 *   tsx scripts/playwright-logo-worker.ts <url> [budgetMs]
 *
 * Output (stdout, single line):
 *   { "ok": true, "dataUrl": "data:image/svg+xml;base64,...",
 *     "width": 140, "height": 32, "viewBox": "0 0 ...",
 *     "source": "header-svg-rendered" }
 *   { "ok": false, "error": "..." }
 *
 * Exit code is always 0 — parent reads the JSON instead. Process
 * failures (browser launch, navigation timeout) emit `{ ok: false }`.
 */
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

const USER_AGENT =
  "LP-Studio-BrandImporter/1.0 (+https://lp.studio) Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36";

function detectChromium(): string | undefined {
  if (process.env["PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH"]) {
    return process.env["PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH"];
  }
  for (const name of ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"]) {
    try {
      const out = execSync(`command -v ${name} 2>/dev/null`, { encoding: "utf8" }).trim();
      if (out && existsSync(out)) return out;
    } catch {
      /* keep looking */
    }
  }
  return undefined;
}

interface WorkerSuccess {
  ok: true;
  dataUrl: string;
  width: number;
  height: number;
  viewBox: string | null;
  source: "header-svg-rendered";
}
interface WorkerFailure {
  ok: false;
  error: string;
}
type WorkerResult = WorkerSuccess | WorkerFailure;

function emit(result: WorkerResult): void {
  process.stdout.write(JSON.stringify(result) + "\n");
}

async function run(url: string, budgetMs: number): Promise<WorkerResult> {
  const executablePath = detectChromium();
  if (!executablePath) {
    return { ok: false, error: "no chromium binary on PATH" };
  }

  // Cap goto + extraction at ~70% of total budget; the rest is browser
  // launch + cleanup. Empirically launch is 800-1500ms on Replit.
  const navTimeoutMs = Math.max(3_000, Math.floor(budgetMs * 0.7));

  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath,
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    });
    const context = await browser.newContext({
      userAgent: USER_AGENT,
      viewport: { width: 1280, height: 800 },
      // Don't carry storage across runs; we want first-paint behavior.
      acceptDownloads: false,
    });
    // Block heavy resources we don't need for SVG extraction.
    await context.route("**/*", (route) => {
      const t = route.request().resourceType();
      if (t === "image" || t === "media" || t === "font") return route.abort();
      return route.continue();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(navTimeoutMs);

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: navTimeoutMs });
    // Let SPAs hydrate the header — most ship a CSS-driven first paint
    // within ~500ms of DOMContentLoaded.
    await page.waitForTimeout(600);

    const result = await page.evaluate(() => {
      // In-page: find the most logo-shaped SVG in the top region.
      // Heuristic: prefer SVGs inside <header>, <nav>, or with logo/brand/
      // wordmark in any ancestor's class/id; rank by visible area; cap at
      // 64KB serialized to avoid sending entire icon sprite sheets back.
      const KEY_RE = /logo|wordmark|brand|mark(?:e?n)?/i;
      const candidates: { svg: SVGElement; score: number; rect: DOMRect }[] = [];

      const headers = Array.from(document.querySelectorAll("header, nav, [class*='header' i], [class*='navbar' i], [id*='header' i]"));
      const containers = headers.length ? headers : [document.body];

      for (const c of containers) {
        const svgs = c.querySelectorAll("svg");
        svgs.forEach((svg) => {
          const rect = svg.getBoundingClientRect();
          // Skip 0-area and off-screen SVGs
          if (rect.width < 8 || rect.height < 8) return;
          // Skip way-too-large SVGs (background illustrations)
          if (rect.width > 800 || rect.height > 400) return;
          // Skip SVGs above the fold but with aspect ratio = 1 (likely icons)
          // UNLESS their container hints at logo
          const aspect = rect.width / rect.height;
          let score = rect.width * rect.height;
          // Wordmark-shaped SVGs (wider than tall) get a big bonus
          if (aspect > 1.6 && aspect < 8) score *= 2.5;
          // Container hint bonus
          let anc: Element | null = svg.parentElement;
          let hops = 0;
          while (anc && hops < 4) {
            const haystack = `${anc.className ?? ""} ${anc.id ?? ""}`;
            if (typeof haystack === "string" && KEY_RE.test(haystack)) {
              score *= 3;
              break;
            }
            anc = anc.parentElement;
            hops++;
          }
          // Position bonus — closer to top-left wins (logo convention)
          if (rect.top < 120 && rect.left < 500) score *= 1.5;
          // Aria/title hint bonus
          const aria = svg.getAttribute("aria-label") ?? "";
          const title = svg.querySelector("title")?.textContent ?? "";
          if (KEY_RE.test(`${aria} ${title}`)) score *= 2;
          candidates.push({ svg, score, rect });
        });
      }

      candidates.sort((a, b) => b.score - a.score);
      const best = candidates[0];
      if (!best) return null;

      // Inline computed dimensions into the SVG so the data URL renders at
      // the brand's intended size without ambient CSS.
      const clone = best.svg.cloneNode(true) as SVGElement;
      if (!clone.getAttribute("xmlns")) clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      if (!clone.getAttribute("viewBox")) {
        // Synthesize a viewBox from the rendered box so the SVG scales
        clone.setAttribute("viewBox", `0 0 ${Math.round(best.rect.width)} ${Math.round(best.rect.height)}`);
      }
      // Strip width/height attributes so the consumer can size it freely
      clone.removeAttribute("width");
      clone.removeAttribute("height");

      const serialized = new XMLSerializer().serializeToString(clone);
      if (serialized.length > 64 * 1024) return null;

      return {
        markup: serialized,
        width: Math.round(best.rect.width),
        height: Math.round(best.rect.height),
        viewBox: clone.getAttribute("viewBox"),
      };
    });

    if (!result) {
      return { ok: false, error: "no candidate SVG found in header" };
    }

    const base64 = Buffer.from(result.markup, "utf8").toString("base64");
    return {
      ok: true,
      dataUrl: `data:image/svg+xml;base64,${base64}`,
      width: result.width,
      height: result.height,
      viewBox: result.viewBox,
      source: "header-svg-rendered",
    };
  } catch (e) {
    return { ok: false, error: `playwright: ${e instanceof Error ? e.message : String(e)}` };
  } finally {
    if (browser) {
      try { await browser.close(); } catch { /* noop */ }
    }
  }
}

async function main(): Promise<void> {
  const url = process.argv[2];
  const budgetMs = Number(process.argv[3] ?? "10000");
  if (!url) {
    emit({ ok: false, error: "missing url argv" });
    return;
  }
  try {
    new URL(url);
  } catch {
    emit({ ok: false, error: "invalid url" });
    return;
  }
  const result = await run(url, budgetMs);
  emit(result);
}

main().catch((e) => {
  emit({ ok: false, error: `worker crashed: ${e instanceof Error ? e.message : String(e)}` });
});
