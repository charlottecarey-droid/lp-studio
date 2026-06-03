import * as cheerio from "cheerio";
import sharp from "sharp";
import dns from "dns/promises";
import net from "net";
import { USER_AGENT } from "./types";
import type { Evidence, FetchedStylesheet, ScrapedPage } from "./types";
import { fetchRobotsVerdict } from "./robots";

// ── SSRF guard: every outbound fetch for a URL derived from the target
// page (stylesheets, direct HTML, screenshot host) must re-validate that
// the resolved IP is not a private/reserved range. The initial URL was
// already checked at the route boundary; redirects and absolute stylesheet
// URLs can still point at internal infra. ────────────────────────────────
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
const safeHostCache = new Map<string, boolean>();
async function isSafePublicHost(hostname: string): Promise<boolean> {
  if (!hostname || hostname === "localhost") return false;
  const cached = safeHostCache.get(hostname);
  if (cached !== undefined) return cached;
  try {
    const records = await dns.lookup(hostname, { all: true });
    if (!records.length) { safeHostCache.set(hostname, false); return false; }
    const ok = records.every((r) => !isPrivateOrReservedIp(r.address));
    safeHostCache.set(hostname, ok);
    return ok;
  } catch {
    safeHostCache.set(hostname, false);
    return false;
  }
}
async function urlIsSafe(url: string): Promise<boolean> {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    return await isSafePublicHost(u.hostname);
  } catch {
    return false;
  }
}

// Markdown-only sub-page scrapes return quickly. The home page additionally
// renders a full-page screenshot + rawHtml, and for heavy/slow sites (large
// e-commerce homepages, often behind bot-protection) firecrawl's headless
// browser can take 15-25s to settle. A single tight timeout starves that home
// scrape — and because the home scrape is the ONLY source of the screenshot,
// pixel-sampled palette, and rawHTML, losing it cascades into empty/failed
// color/logo/typography results (observed as "nothing imported" for slow
// retail sites). So screenshot scrapes get a much larger budget than the
// quick markdown sub-pages.
const FIRECRAWL_TIMEOUT_MS = 12000;
const FIRECRAWL_SCREENSHOT_TIMEOUT_MS = 30000;
const RAW_HTML_TIMEOUT_MS = 5000;
const STYLESHEET_TIMEOUT_MS = 4000;
const SCREENSHOT_FETCH_TIMEOUT_MS = 8000;
const ROBOTS_TIMEOUT_MS = 4000;

// Upper bound for the whole buildEvidence() phase. Its slow steps run
// sequentially in the worst case: robots fetch (awaited before scrapes) ->
// home screenshot scrape (the dominant cost) -> stylesheet fetches ->
// screenshot-buffer fetch -> palette sampling. The orchestrator wraps
// buildEvidence in a single hard timeout, and exceeding it fails the ENTIRE
// import (no dimensions stream at all), so this must clear the sum of those
// maxima with margin. Derived from the constants above so it can't silently
// drift when an individual timeout is retuned.
export const EVIDENCE_BUILD_BUDGET_MS =
  ROBOTS_TIMEOUT_MS +
  FIRECRAWL_SCREENSHOT_TIMEOUT_MS +
  STYLESHEET_TIMEOUT_MS +
  SCREENSHOT_FETCH_TIMEOUT_MS +
  6000; // palette sampling + scheduling slack
const MAX_STYLESHEETS = 3;
const MAX_STYLESHEET_BYTES = 200 * 1024;
const MAX_SCREENSHOT_BYTES = 8 * 1024 * 1024;

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctl.signal });
  } finally {
    clearTimeout(t);
  }
}

interface FirecrawlResult {
  url: string;
  markdown: string;
  rawHtml: string | null;
  screenshotUrl: string | null;
}

async function firecrawlScrape(
  apiKey: string,
  url: string,
  opts: { withScreenshot: boolean; withRawHtml: boolean },
): Promise<FirecrawlResult | null> {
  const formats: string[] = ["markdown"];
  if (opts.withScreenshot) formats.push("screenshot");
  if (opts.withRawHtml) formats.push("rawHtml");
  try {
    const res = await fetchWithTimeout(
      "https://api.firecrawl.dev/v1/scrape",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "User-Agent": USER_AGENT,
        },
        body: JSON.stringify({
          url,
          formats,
          onlyMainContent: false,
          waitFor: 1500,
        }),
      },
      opts.withScreenshot ? FIRECRAWL_SCREENSHOT_TIMEOUT_MS : FIRECRAWL_TIMEOUT_MS,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      success?: boolean;
      data?: { markdown?: string; screenshot?: string; rawHtml?: string };
    };
    const md = (data?.data?.markdown ?? "").trim();
    const shot = data?.data?.screenshot ?? null;
    const html = data?.data?.rawHtml ?? null;
    if (!md && !shot && !html) return null;
    return { url, markdown: md, rawHtml: html, screenshotUrl: shot };
  } catch {
    return null;
  }
}

// Fallback: when firecrawl returns no rawHtml (or fails), fetch the page
// directly with our UA. This gives us cheerio-parseable HTML for the
// deterministic extractors (logos, CSS-var colors, link-tag typography).
async function fetchRawHtmlDirect(url: string): Promise<string | null> {
  if (!(await urlIsSafe(url))) return null;
  try {
    // Walk redirects manually so we re-validate every hop against the SSRF
    // guard (a 302 to 127.0.0.1 would otherwise be followed silently).
    let current = url;
    for (let hop = 0; hop < 5; hop++) {
      const res = await fetchWithTimeout(
        current,
        {
          headers: {
            "User-Agent": USER_AGENT,
            Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
          },
          redirect: "manual",
        },
        RAW_HTML_TIMEOUT_MS,
      );
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) return null;
        const next = safeJoinUrl(current, loc);
        if (!next || !(await urlIsSafe(next))) return null;
        current = next;
        continue;
      }
      if (!res.ok) return null;
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("html")) return null;
      const text = await res.text();
      return text.slice(0, 1_500_000);
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchStylesheet(url: string): Promise<FetchedStylesheet | null> {
  if (!(await urlIsSafe(url))) return null;
  try {
    const res = await fetchWithTimeout(
      url,
      { headers: { "User-Agent": USER_AGENT, Accept: "text/css,*/*;q=0.1" } },
      STYLESHEET_TIMEOUT_MS,
    );
    if (!res.ok) return null;
    const reader = res.body?.getReader();
    if (!reader) {
      const txt = await res.text();
      return { url, css: txt.slice(0, MAX_STYLESHEET_BYTES), bytes: txt.length };
    }
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      chunks.push(value);
      if (total > MAX_STYLESHEET_BYTES) break;
    }
    const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
    return { url, css: buf.toString("utf8").slice(0, MAX_STYLESHEET_BYTES), bytes: total };
  } catch {
    return null;
  }
}

async function fetchScreenshotBuffer(screenshotUrl: string): Promise<{ buf: Buffer; contentType: string } | null> {
  if (!(await urlIsSafe(screenshotUrl))) return null;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), SCREENSHOT_FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(screenshotUrl, {
        signal: ctl.signal,
        headers: { "User-Agent": USER_AGENT },
      });
      if (!res.ok) return null;
      const ab = await res.arrayBuffer();
      if (ab.byteLength > MAX_SCREENSHOT_BYTES) return null;
      const contentType = res.headers.get("content-type") ?? "image/png";
      return { buf: Buffer.from(ab), contentType };
    } finally {
      clearTimeout(t);
    }
  } catch {
    return null;
  }
}

/**
 * Produce a lightweight, persistable preview of the homepage screenshot.
 *
 * The full-resolution `screenshotDataUrl` can be up to MAX_SCREENSHOT_BYTES
 * (8MB) because the vision extractors (colors/buttons/typography) need the
 * detail. That's too heavy to (a) re-host as a Brand-Settings preview asset —
 * the asset-mirror's per-asset cap is 5MB — and (b) cache verbatim in the
 * brand-import cache jsonb. So we downsample to a width-capped JPEG that's
 * comfortably under the mirror cap and cheap to cache, while staying perfectly
 * legible as a "what your homepage looked like" preview. Vision keeps using the
 * untouched `screenshotDataUrl`; only the persisted/cached copy is shrunk.
 * Best-effort: returns null on any failure (no preview rather than a broken
 * import).
 */
export async function buildScreenshotPreviewDataUrl(dataUrl: string | null): Promise<string | null> {
  if (!dataUrl || !dataUrl.startsWith("data:")) return null;
  const m = dataUrl.match(/^data:([^;,]+)(;base64)?,(.+)$/);
  if (!m) return null;
  try {
    const buf = m[2]
      ? Buffer.from(m[3], "base64")
      : Buffer.from(decodeURIComponent(m[3]), "utf8");
    if (!buf.length) return null;
    const out = await sharp(buf)
      .resize({ width: 1600, withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
    return `data:image/jpeg;base64,${out.toString("base64")}`;
  } catch {
    return null;
  }
}

async function samplePaletteFromBuffer(buf: Buffer): Promise<string[]> {
  try {
    const { data, info } = await sharp(buf)
      .resize(200, null, { fit: "inside", withoutEnlargement: true })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const STEP = 16;
    const counts = new Map<number, number>();
    for (let i = 0; i < data.length; i += info.channels) {
      const r = Math.floor(data[i] / STEP);
      const g = Math.floor(data[i + 1] / STEP);
      const b = Math.floor(data[i + 2] / STEP);
      const key = (r << 8) | (g << 4) | b;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);

    const keyToRgb = (key: number): [number, number, number] => [
      Math.min(255, Math.round(((key >> 8) & 0xf) * STEP + STEP / 2)),
      Math.min(255, Math.round(((key >> 4) & 0xf) * STEP + STEP / 2)),
      Math.min(255, Math.round((key & 0xf) * STEP + STEP / 2)),
    ];
    const toHex = ([r, g, b]: [number, number, number]): string =>
      `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
    const satOf = ([r, g, b]: [number, number, number]): number => {
      const max = Math.max(r, g, b);
      return max === 0 ? 0 : (max - Math.min(r, g, b)) / max;
    };
    // Salience = saturation × chroma. A pure frequency histogram on a
    // photo-heavy homepage surfaces muddy product-photo tones and buries the
    // brand accent, so re-rank the frequent buckets to float chromatic colors.
    const salienceOf = (rgb: [number, number, number]): number =>
      satOf(rgb) * (Math.max(...rgb) - Math.min(...rgb));

    // Keep the most-frequent distinct buckets (the original window), then
    // re-rank them by salience so the brand accent leads the returned list.
    const kept: { hex: string; salience: number }[] = [];
    const seen = new Set<string>();
    for (const [key] of sorted) {
      const rgb = keyToRgb(key);
      const hex = toHex(rgb);
      if (seen.has(hex)) continue;
      seen.add(hex);
      kept.push({ hex, salience: salienceOf(rgb) });
      if (kept.length >= 12) break;
    }
    kept.sort((a, b) => b.salience - a.salience);
    const out = kept.map((k) => k.hex);

    // Hard floor: if a strongly-saturated color (saturation > 0.55) exists
    // among the most-frequent buckets, surface it to the front even when it is
    // comparatively infrequent and fell outside the kept window.
    for (const [key] of sorted.slice(0, 48)) {
      const rgb = keyToRgb(key);
      if (satOf(rgb) <= 0.55) continue;
      const hex = toHex(rgb);
      const idx = out.indexOf(hex);
      if (idx === 0) break;
      if (idx > 0) out.splice(idx, 1);
      out.unshift(hex);
      break;
    }
    return out;
  } catch {
    return [];
  }
}

function safeJoinUrl(base: string, path: string): string | null {
  try {
    return new URL(path, base).toString();
  } catch {
    return null;
  }
}

function extractCssVarPaletteHints(
  $: cheerio.CheerioAPI,
  stylesheets: FetchedStylesheet[],
): { name: string; value: string }[] {
  const hexRe = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
  const namePattern = /--(?:brand|primary|secondary|accent|cta|button|bg|background|surface|card|text|fg|foreground|nav|border|color)[a-zA-Z0-9-]*/g;
  const found = new Map<string, string>();

  const consume = (css: string): void => {
    // crude rule walker: pull declarations of the form `--name: value;`
    const declRe = /(--[a-zA-Z0-9-]+)\s*:\s*([^;{}]+?)\s*(?:!important)?\s*[;}]/g;
    let m: RegExpExecArray | null;
    while ((m = declRe.exec(css))) {
      const name = m[1];
      if (!name.match(namePattern)) {
        namePattern.lastIndex = 0;
        continue;
      }
      namePattern.lastIndex = 0;
      const value = m[2].trim();
      const hex = value.match(/#[0-9a-fA-F]{3,8}\b/)?.[0]
        ?? value.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/)?.[0]
        ?? null;
      if (!hex) continue;
      let normalized: string;
      if (hex.startsWith("rgb")) {
        const m2 = hex.match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
        if (!m2) continue;
        const [r, g, b] = [+m2[1], +m2[2], +m2[3]];
        normalized = `#${[r, g, b].map((c) => Math.min(255, c).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
      } else {
        const h = hex.replace("#", "");
        const expanded = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6);
        if (expanded.length !== 6 || !hexRe.test("#" + expanded)) continue;
        normalized = `#${expanded.toUpperCase()}`;
      }
      if (!found.has(name)) found.set(name, normalized);
    }
  };

  $("style").each((_, el) => consume($(el).text() ?? ""));
  for (const s of stylesheets) consume(s.css);
  return [...found.entries()].map(([name, value]) => ({ name, value }));
}

// Reliability fallback: when neither a pixel-sampled screenshot palette nor
// named CSS custom properties are available (some sites block the screenshot
// host, or declare brand colors as plain hex/rgb on classes rather than as
// `--vars`), harvest the most frequently declared colors straight out of the
// page's stylesheets + inline styles. This keeps the color extractor from
// hard-failing on sites that genuinely do have colors, just not in the two
// preferred forms. Near-grey/black/white colors are kept (the extractor needs
// background/text candidates) but ranked by raw frequency.
export function harvestCssColorHints(
  $: cheerio.CheerioAPI,
  stylesheets: FetchedStylesheet[],
): string[] {
  const counts = new Map<string, number>();
  const bump = (hex: string): void => {
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  };

  const normalizeHex = (raw: string): string | null => {
    const h = raw.replace("#", "");
    if (h.length === 3) {
      const e = h.split("").map((c) => c + c).join("");
      return `#${e.toUpperCase()}`;
    }
    if (h.length === 6 || h.length === 8) {
      return `#${h.slice(0, 6).toUpperCase()}`;
    }
    return null;
  };

  const consume = (css: string): void => {
    let m: RegExpExecArray | null;
    const hexRe = /#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;
    while ((m = hexRe.exec(css))) {
      const n = normalizeHex(m[0]);
      if (n) bump(n);
    }
    const rgbRe = /rgba?\(\s*(\d{1,3})[,\s]+(\d{1,3})[,\s]+(\d{1,3})/g;
    while ((m = rgbRe.exec(css))) {
      const [r, g, b] = [+m[1], +m[2], +m[3]];
      if (r > 255 || g > 255 || b > 255) continue;
      bump(`#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`.toUpperCase());
    }
  };

  $("style").each((_, el) => consume($(el).text() ?? ""));
  $("[style]").each((_, el) => consume($(el).attr("style") ?? ""));
  for (const s of stylesheets) consume(s.css);

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([hex]) => hex)
    .slice(0, 12);
}

function discoverStylesheetUrls($: cheerio.CheerioAPI, baseUrl: string): string[] {
  const urls: string[] = [];
  $('link[rel~="stylesheet"]').each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const abs = safeJoinUrl(baseUrl, href);
    if (!abs) return;
    // Skip font CSS — typography extractor handles those separately
    if (/fonts\.googleapis\.com|use\.typekit\.net|fonts\.gstatic\.com/.test(abs)) return;
    // Prefer same-origin first to avoid CDNs serving JSON or huge bundles
    urls.push(abs);
  });
  // Same-origin first, dedup
  try {
    const home = new URL(baseUrl);
    urls.sort((a, b) => {
      const ah = new URL(a).host === home.host ? 0 : 1;
      const bh = new URL(b).host === home.host ? 0 : 1;
      return ah - bh;
    });
  } catch { /* noop */ }
  return [...new Set(urls)].slice(0, MAX_STYLESHEETS);
}

export async function buildEvidence(
  homeUrl: string,
  firecrawlApiKey: string,
): Promise<Evidence> {
  const candidatePaths = ["/", "/about", "/pricing"];
  const candidateUrls = candidatePaths
    .map((p) => safeJoinUrl(homeUrl, p))
    .filter((u): u is string => !!u);

  const robotsP = fetchRobotsVerdict(homeUrl, candidatePaths, ROBOTS_TIMEOUT_MS);
  const directHtmlP = fetchRawHtmlDirect(homeUrl);

  // Always ask firecrawl for the home page with markdown + screenshot +
  // rawHtml. Sub-pages get markdown only (used by voice/photography for
  // copy & image hints; firecrawl rawHtml falls back to our own fetch).
  const robots = await robotsP;
  const allowedCandidates = candidateUrls.filter((u) => {
    try {
      const p = new URL(u).pathname.replace(/\/+$/, "") || "/";
      const matchPath = p === "/" ? "/" : p;
      return robots.allowed[matchPath] !== false;
    } catch {
      return true;
    }
  });

  const scrapePromises = allowedCandidates.map((u, i) =>
    firecrawlScrape(firecrawlApiKey, u, {
      withScreenshot: i === 0,
      withRawHtml: i === 0,
    }),
  );
  const scrapes = (await Promise.all(scrapePromises)).filter((s): s is FirecrawlResult => !!s);

  const pages: ScrapedPage[] = scrapes.map((s) => ({
    url: s.url,
    markdown: s.markdown,
    rawHtml: s.rawHtml,
    screenshotUrl: s.screenshotUrl,
    fetchedAt: Date.now(),
  }));

  // Backfill home rawHtml from direct fetch if firecrawl didn't return it
  const directHtml = await directHtmlP;
  const home = pages[0];
  if (home && !home.rawHtml && directHtml) {
    home.rawHtml = directHtml;
  } else if (!home && directHtml) {
    pages.push({
      url: homeUrl,
      markdown: "",
      rawHtml: directHtml,
      screenshotUrl: null,
      fetchedAt: Date.now(),
    });
  }

  const errors: string[] = [];
  if (!pages.length) errors.push("evidence: no pages scraped");

  const homeRaw = pages.find((p) => p.rawHtml)?.rawHtml ?? null;
  const $home = homeRaw ? cheerio.load(homeRaw) : null;

  // Discover + fetch up to 3 stylesheets (same-origin first) in parallel
  let stylesheets: FetchedStylesheet[] = [];
  if ($home) {
    const sheetUrls = discoverStylesheetUrls($home, homeUrl);
    const sheets = await Promise.all(sheetUrls.map((u) => fetchStylesheet(u)));
    stylesheets = sheets.filter((s): s is FetchedStylesheet => !!s);
  }

  const screenshotUrl = pages.find((p) => p.screenshotUrl)?.screenshotUrl ?? null;
  const screenshotFetch = screenshotUrl ? await fetchScreenshotBuffer(screenshotUrl) : null;
  let sampledPalette = screenshotFetch ? await samplePaletteFromBuffer(screenshotFetch.buf) : [];
  // Inline as data: URL — OpenAI's fetcher gets blocked/throttled by some
  // firecrawl screenshot hosts; passing the bytes directly avoids that.
  const screenshotDataUrl = screenshotFetch
    ? `data:${screenshotFetch.contentType};base64,${screenshotFetch.buf.toString("base64")}`
    : null;
  const cssVarPaletteHints = $home ? extractCssVarPaletteHints($home, stylesheets) : [];

  // Reliability fallback: only when both preferred color sources came up empty
  // (no screenshot palette AND no named CSS vars) do we harvest raw declared
  // colors from CSS/inline styles, so the color extractor has something to
  // work with instead of hard-failing. We never override a real screenshot
  // palette with this lower-quality signal.
  if (!sampledPalette.length && !cssVarPaletteHints.length && $home) {
    const harvested = harvestCssColorHints($home, stylesheets);
    if (harvested.length) sampledPalette = harvested;
  }

  return {
    homeUrl,
    pages,
    stylesheets,
    $home,
    robots,
    screenshotUrl,
    screenshotDataUrl,
    sampledPalette,
    cssVarPaletteHints,
    errors,
  };
}
