import type * as cheerio from "cheerio";
import { spawn } from "node:child_process";
import path from "node:path";
import type { Evidence, DimensionResult, LogoCandidate, LogosData } from "../types";

// Budget for the out-of-process Playwright fallback. Has to fit comfortably
// inside the per-extractor 20s budget: launch + nav + extract is typically
// 2-5s; cap at 10s so a runaway page can't starve the rest of logos.
const PLAYWRIGHT_FALLBACK_BUDGET_MS = 10_000;

interface PlaywrightWorkerSuccess {
  ok: true;
  dataUrl: string;
  width: number;
  height: number;
  viewBox: string | null;
  source: "header-svg-rendered";
}
interface PlaywrightWorkerFailure {
  ok: false;
  error: string;
}
type PlaywrightWorkerResult = PlaywrightWorkerSuccess | PlaywrightWorkerFailure;

// Spawn `scripts/playwright-logo-worker.ts` via tsx so the parent (the
// API server) doesn't get a Playwright lifecycle attached to its event
// loop. The worker emits a single line of JSON on stdout and exits.
async function runPlaywrightLogoFallback(url: string): Promise<PlaywrightWorkerResult> {
  // The script lives at <api-server>/scripts/playwright-logo-worker.ts.
  // __dirname here points at .../src/lib/brand-import/extractors when run
  // through tsx, or .../dist/... when compiled — resolve from the api-server
  // root via the package.json location.
  const workerScript = path.resolve(
    process.cwd(),
    "scripts",
    "playwright-logo-worker.ts",
  );

  return await new Promise<PlaywrightWorkerResult>((resolve) => {
    let settled = false;
    const settle = (r: PlaywrightWorkerResult): void => {
      if (settled) return;
      settled = true;
      resolve(r);
    };

    let child;
    try {
      child = spawn(
        process.execPath,
        ["--import", "tsx", workerScript, url, String(PLAYWRIGHT_FALLBACK_BUDGET_MS)],
        {
          stdio: ["ignore", "pipe", "pipe"],
          // Inherit env so PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH propagates if set.
          env: process.env,
          // `detached: true` puts the child into its own process group. The
          // worker then spawns Chromium (which itself fans out into zygote /
          // renderer / GPU processes) — they all inherit that PGID. On hard
          // kill we negate the PID to signal the whole group, otherwise a
          // mid-run SIGKILL leaves orphaned Chromium processes accumulating
          // across importer runs and eventually OOMs the container.
          detached: true,
        },
      );
    } catch (e) {
      settle({ ok: false, error: `spawn failed: ${e instanceof Error ? e.message : String(e)}` });
      return;
    }

    let stdoutBuf = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      stdoutBuf += chunk.toString("utf8");
    });
    // Drain stderr so the pipe buffer doesn't fill and stall the worker;
    // intentionally don't surface playwright's noisy launch logs to ours.
    child.stderr?.on("data", () => { /* noop */ });

    // Kill the entire process group (negative PID), not just the worker
    // Node process — Chromium spawns its own renderer/zygote children and
    // a plain `child.kill()` orphans them. See `detached: true` above.
    const killTree = (signal: NodeJS.Signals): void => {
      if (typeof child.pid !== "number") return;
      try {
        process.kill(-child.pid, signal);
      } catch {
        // ESRCH means the group is already gone; fall back to direct kill.
        try { child.kill(signal); } catch { /* noop */ }
      }
    };
    const killTimer = setTimeout(() => {
      killTree("SIGKILL");
      settle({ ok: false, error: "worker killed (parent budget exceeded)" });
    }, PLAYWRIGHT_FALLBACK_BUDGET_MS + 2_000);

    child.on("error", (err) => {
      clearTimeout(killTimer);
      settle({ ok: false, error: `child error: ${err.message}` });
    });
    child.on("close", () => {
      clearTimeout(killTimer);
      // Worker emits one JSON line at the end of stdout. Tolerate extra
      // chatter by taking the last non-empty line.
      const line = stdoutBuf.split(/\r?\n/).filter(Boolean).pop();
      if (!line) {
        settle({ ok: false, error: "worker produced no stdout" });
        return;
      }
      try {
        const parsed = JSON.parse(line) as PlaywrightWorkerResult;
        settle(parsed);
      } catch (e) {
        settle({ ok: false, error: `worker stdout not JSON: ${e instanceof Error ? e.message : String(e)}` });
      }
    });
  });
}

// cheerio re-exports node types from domhandler which isn't a direct dep here;
// using `cheerio.AnyNode` (re-exported in cheerio 1.x) keeps us off that path.
type CheerioNode = ReturnType<cheerio.CheerioAPI>[number];

function inferFormat(url: string): LogoCandidate["format"] {
  const u = url.toLowerCase().split("?")[0];
  if (u.endsWith(".svg")) return "svg";
  if (u.endsWith(".png")) return "png";
  if (u.endsWith(".jpg") || u.endsWith(".jpeg")) return "jpg";
  if (u.endsWith(".ico")) return "ico";
  if (u.endsWith(".webp")) return "webp";
  if (u.includes("data:image/svg")) return "svg";
  if (u.includes("data:image/png")) return "png";
  return "unknown";
}

function parseDim(v: string | undefined): number | null {
  if (!v) return null;
  const n = parseInt(v.replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function extractLogos(evidence: Evidence): Promise<DimensionResult<LogosData>> {
  const errors: string[] = [];
  const $ = evidence.$home;
  if (!$) {
    return { status: "failed", data: null, confidence: "low", errors: ["no parsed HTML"] };
  }

  const base = evidence.homeUrl;
  const candidates: LogoCandidate[] = [];
  const seen = new Set<string>();
  const push = (c: LogoCandidate): void => {
    if (seen.has(c.url)) return;
    seen.add(c.url);
    candidates.push(c);
  };
  const abs = (u: string | undefined): string | null => {
    if (!u) return null;
    try {
      return new URL(u, base).toString();
    } catch {
      return null;
    }
  };

  // 1. <link rel="icon"|"shortcut icon"|"apple-touch-icon"> + OG image
  $('link[rel~="icon"], link[rel~="shortcut"], link[rel~="apple-touch-icon"], link[rel~="mask-icon"]').each((_, el) => {
    const href = abs($(el).attr("href"));
    if (!href) return;
    const rel = ($(el).attr("rel") ?? "").toLowerCase();
    const sizesAttr = $(el).attr("sizes") ?? "";
    const sizeMatch = sizesAttr.match(/(\d+)x(\d+)/);
    const area = sizeMatch ? Number(sizeMatch[1]) * Number(sizeMatch[2]) : null;
    push({
      url: href,
      source: rel.includes("apple-touch") ? "apple-touch-icon" : "favicon",
      format: inferFormat(href),
      estimatedArea: area,
      transparent: null,
      score: 0,
    });
  });
  const og = abs($('meta[property="og:image"]').attr("content"))
    ?? abs($('meta[name="og:image"]').attr("content"))
    ?? abs($('meta[name="twitter:image"]').attr("content"));
  if (og) {
    push({ url: og, source: "og", format: inferFormat(og), estimatedArea: null, transparent: null, score: 0 });
  }

  // 2. Header logos: <img>/<svg> inside <header> or first <nav>, alt/src/class matching logo
  const containerSelector = "header, nav, [class*='header' i], [class*='navbar' i], [class*='nav-bar' i], [id*='header' i]";
  const footerSelector = "footer, [class*='footer' i], [id*='footer' i]";
  const inspect = (root: cheerio.Cheerio<CheerioNode>, src: "header" | "footer"): void => {
    root.find("img").each((_: number, el: CheerioNode) => {
      const $el = $(el);
      const altRaw = $el.attr("alt") ?? "";
      const srcRaw = $el.attr("src") ?? $el.attr("data-src") ?? "";
      const clsRaw = $el.attr("class") ?? "";
      const haystack = `${altRaw} ${srcRaw} ${clsRaw}`.toLowerCase();
      const looksLogo = /logo|wordmark|brand|mark/.test(haystack);
      const url = abs(srcRaw);
      if (!url || !looksLogo) return;
      const w = parseDim($el.attr("width"));
      const h = parseDim($el.attr("height"));
      const area = w && h ? w * h : null;
      push({
        url,
        source: src,
        format: inferFormat(url),
        estimatedArea: area,
        transparent: null,
        score: 0,
      });
    });
    // Inline SVGs (we can't easily extract them, but if there's a <use href> or
    // <image href> pointing at an external file, use that)
    root.find("svg image, svg use").each((_: number, el: CheerioNode) => {
      const href = $(el).attr("href") ?? $(el).attr("xlink:href");
      const url = abs(href);
      if (!url) return;
      const parent = $(el).closest("[class],[id]");
      const haystack = `${parent.attr("class") ?? ""} ${parent.attr("id") ?? ""}`.toLowerCase();
      if (!/logo|wordmark|brand|mark/.test(haystack)) return;
      push({ url, source: src === "header" ? "svg-alt" : src, format: inferFormat(url), estimatedArea: null, transparent: true, score: 0 });
    });
  };
  inspect($(containerSelector).first(), "header");
  inspect($(footerSelector).first(), "footer");

  // 3. Any IMG with class/alt explicitly containing "logo" anywhere in the doc
  $('img[alt*="logo" i], img[class*="logo" i], img[src*="logo" i]').each((_, el) => {
    const $el = $(el);
    const url = abs($el.attr("src") ?? $el.attr("data-src"));
    if (!url) return;
    const w = parseDim($el.attr("width"));
    const h = parseDim($el.attr("height"));
    push({
      url,
      source: "svg-alt",
      format: inferFormat(url),
      estimatedArea: w && h ? w * h : null,
      transparent: null,
      score: 0,
    });
  });

  // Score: header strongly preferred; SVG bonus; favicons get a small score
  // so they always rank last but stay as alternates.
  // `header-svg-rendered` outranks plain header because it's a Playwright-
  // rendered inline SVG — visually true to what users see in the browser,
  // and only used when the cheerio pass couldn't find a real header logo.
  const sourceWeight: Record<LogoCandidate["source"], number> = {
    "header-svg-rendered": 120,
    header: 100,
    "svg-alt": 60,
    og: 40,
    footer: 35,
    "apple-touch-icon": 20,
    favicon: 10,
  };
  const formatBonus: Record<LogoCandidate["format"], number> = {
    svg: 30,
    png: 20,
    webp: 18,
    jpg: 10,
    ico: 0,
    unknown: 5,
  };
  for (const c of candidates) {
    const area = c.estimatedArea ?? 0;
    const areaBonus = area > 0 ? Math.min(40, Math.log2(area + 1) * 3) : 0;
    c.score = sourceWeight[c.source] + formatBonus[c.format] + areaBonus;
  }
  candidates.sort((a, b) => b.score - a.score);

  // Playwright fallback — runs only when the deterministic pass couldn't
  // find a real header/footer/svg-alt candidate. This is the case on
  // Stripe / Anthropic / Vercel-style sites that render their wordmark as
  // an inline <svg> with no `alt`, no `aria-label`, and no `<use href>` —
  // cheerio sees a path soup and we fall back to favicon. Spawning an
  // out-of-process Chromium lets us serialize the rendered SVG into a
  // data URL and surface it as the brand logo.
  const topIsBrandLogo = candidates[0] &&
    (candidates[0].source === "header" ||
      candidates[0].source === "footer" ||
      candidates[0].source === "svg-alt");
  if (!topIsBrandLogo) {
    const fallback = await runPlaywrightLogoFallback(base);
    if (fallback.ok) {
      const area = fallback.width * fallback.height;
      push({
        url: fallback.dataUrl,
        source: "header-svg-rendered",
        format: "svg",
        estimatedArea: area > 0 ? area : null,
        transparent: true,
        score: 0,
      });
      // Re-score the freshly-added candidate (loop above already ran)
      const newCand = candidates[candidates.length - 1];
      if (newCand && newCand.source === "header-svg-rendered") {
        const areaBonus = newCand.estimatedArea && newCand.estimatedArea > 0
          ? Math.min(40, Math.log2(newCand.estimatedArea + 1) * 3)
          : 0;
        newCand.score = sourceWeight["header-svg-rendered"] + formatBonus["svg"] + areaBonus;
      }
      candidates.sort((a, b) => b.score - a.score);
    } else {
      errors.push(`playwright logo fallback: ${fallback.error}`);
    }
  }

  if (!candidates.length) {
    return {
      status: "failed",
      data: null,
      confidence: "low",
      errors: ["no logo candidates found"],
    };
  }

  const def = candidates[0];
  const status: DimensionResult<LogosData>["status"] =
    def.source === "favicon" && candidates.length === 1 ? "partial" : "ok";
  const confidence =
    def.source === "header" || def.source === "svg-alt" || def.source === "header-svg-rendered"
      ? "high"
      : def.source === "footer" || def.source === "og"
      ? "medium"
      : "low";

  // Best favicon for the tenant's browser-tab icon. `candidates` is already
  // score-sorted, so the first favicon/apple-touch-icon entry is the highest
  // scored one (apple-touch-icon PNGs outrank tiny .ico favicons via the
  // source/format/area weighting above). Computed from the full candidate
  // list rather than the sliced alternates so a busy header with >8 logo
  // candidates can't push the favicon out of view.
  const faviconCand = candidates.find(
    (c) => c.source === "favicon" || c.source === "apple-touch-icon",
  );

  return {
    status,
    data: {
      defaultLogoUrl: def.url,
      alternates: candidates.slice(0, 8),
      faviconUrl: faviconCand?.url ?? null,
    },
    confidence,
    errors,
  };
}
