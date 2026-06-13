import * as cheerio from "cheerio";
import sharp from "sharp";
import dns from "dns/promises";
import net from "net";
import { USER_AGENT } from "./types";
import type { Evidence, FetchedStylesheet, ScrapedPage } from "./types";
import { fetchRobotsVerdict } from "./robots";
import { logger } from "../logger";
import { makeSemaphore, envConcurrency } from "../semaphore";

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
const SITEMAP_TIMEOUT_MS = 4000;

// ── Multi-page crawl budget (P0-1) ───────────────────────────────────────────
// The importer was breadth-starved: only `/`, `/about`, `/pricing` were ever
// scraped, so voice/content saw little copy and photography only ever harvested
// the homepage. We now discover a smarter, fuller page set (sitemap + homepage
// nav links + a richer static fallback) and scrape up to MAX_CRAWL_PAGES of them
// in parallel behind a Firecrawl concurrency semaphore. Non-home pages are
// markdown-only (cheap + fast); the home page keeps its rawHtml + screenshot.
// A small number of the most image-rich discovered pages (products / customers /
// case-studies) ALSO get rawHtml so the photography + content extractors can see
// their product/testimonial imagery and copy — bounded by MAX_EXTRA_RAWHTML.
const MAX_CRAWL_PAGES = 7;
const MAX_EXTRA_RAWHTML = 3;
// Firecrawl concurrency cap for the multi-page fan-out. The home screenshot
// scrape is the dominant cost; capping parallel scrapes keeps us from bursting
// Firecrawl (and our own egress) with 7 simultaneous headless renders while
// still finishing the markdown-only sub-pages well inside the build budget.
const FIRECRAWL_CONCURRENCY = envConcurrency("BRAND_IMPORT_FIRECRAWL_CONCURRENCY", 4);
const firecrawlSemaphore = makeSemaphore({ name: "brand-import-firecrawl", max: FIRECRAWL_CONCURRENCY });

// Upper bound for the whole buildEvidence() phase. Its slow steps run
// sequentially in the worst case: robots fetch (awaited before scrapes) ->
// home screenshot scrape (the dominant cost) -> stylesheet fetches ->
// screenshot-buffer fetch -> palette sampling. The orchestrator wraps
// buildEvidence in a single hard timeout, and exceeding it fails the ENTIRE
// import (no dimensions stream at all), so this must clear the sum of those
// maxima with margin. Derived from the constants above so it can't silently
// drift when an individual timeout is retuned.
// The multi-page crawl (P0-1) adds: a sitemap fetch (bounded), and a parallel
// fan-out of markdown-only sub-page scrapes behind firecrawlSemaphore. Because
// the home screenshot scrape and the sub-page scrapes run concurrently, the
// fan-out does NOT add FIRECRAWL_SCREENSHOT_TIMEOUT_MS per page — the dominant
// term is still the single home screenshot scrape. We add one markdown-scrape
// timeout of headroom for the worst case where the sub-page batch finishes just
// after the screenshot (semaphore serialization), plus the extra-rawHtml fetch
// window, so a slow sub-page batch can't push the whole build past the budget.
export const EVIDENCE_BUILD_BUDGET_MS =
  ROBOTS_TIMEOUT_MS +
  SITEMAP_TIMEOUT_MS +
  FIRECRAWL_SCREENSHOT_TIMEOUT_MS +
  FIRECRAWL_TIMEOUT_MS + // slowest queued markdown sub-page batch (parallel w/ screenshot)
  STYLESHEET_TIMEOUT_MS +
  SCREENSHOT_FETCH_TIMEOUT_MS +
  RAW_HTML_TIMEOUT_MS + // extra image-rich-page rawHtml backfill
  8000; // palette sampling + scheduling slack
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
  // Serialize through the Firecrawl concurrency semaphore so the multi-page
  // fan-out can't burst N simultaneous headless renders.
  return firecrawlSemaphore.run(() => firecrawlScrapeInner(apiKey, url, opts));
}

async function firecrawlScrapeInner(
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
  // Match a role keyword as a dash-delimited *segment* ANYWHERE in the custom
  // property name — not just immediately after the leading `--`. Design-system
  // sites namespace their tokens (e.g. Stripe's `--hds-color-core-brand-600`,
  // `--hds-color-button-primary-bg`), so the old anchored `--brand…` match
  // silently skipped every real brand token and the extractor never saw the
  // brand color at all. `color` is deliberately omitted from the keyword set:
  // it appears in nearly every token name on such sites and would flood the
  // hints with noise. The `i` flag also catches camelCase (e.g. `brandDark`).
  const namePattern = /--(?:[a-z0-9]+-)*(?:brand|primary|secondary|accent|cta|link|button|bg|background|surface|card|text|fg|foreground|nav|border)(?:[-0-9a-z]*)?$/i;
  const found = new Map<string, string>();

  const consume = (css: string): void => {
    // crude rule walker: pull declarations of the form `--name: value;`
    const declRe = /(--[a-zA-Z0-9-]+)\s*:\s*([^;{}]+?)\s*(?:!important)?\s*[;}]/g;
    let m: RegExpExecArray | null;
    while ((m = declRe.exec(css))) {
      const name = m[1];
      if (!namePattern.test(name)) continue;
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

  // Surface the highest-signal brand tokens first, then cap the list so a
  // design-system site's hundreds of role-named tokens can't bury the
  // brand/primary entries (or blow up the downstream LLM prompt). The color
  // extractor scans this whole returned (capped) list for its deterministic
  // brand pick; brand/primary are sorted to the front so the cap never drops
  // them, and the prompt + swatch UI only slice the head.
  const PRIORITY = ["brand", "primary", "secondary", "accent", "cta", "link", "button", "nav", "surface", "card", "background", "bg", "foreground", "fg", "text", "border"];
  const rolePriority = (name: string): number => {
    const lower = name.toLowerCase();
    for (let i = 0; i < PRIORITY.length; i++) if (lower.includes(PRIORITY[i])) return i;
    return PRIORITY.length;
  };
  return [...found.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => rolePriority(a.name) - rolePriority(b.name))
    .slice(0, 48);
}

/**
 * Dark-theme color harvest (P0-2). Scans the fetched CSS (inline <style> +
 * stylesheets) for dark-theme SCOPES and extracts the named color custom
 * properties declared inside them. Dark scopes recognized:
 *   • `@media (prefers-color-scheme: dark) { … }`
 *   • selector rules whose selector matches a dark toggle:
 *     `[data-theme="dark"]`, `[data-mode="dark"]`, `.dark`, `:root.dark`,
 *     `html.dark`, `.theme-dark`, `[data-color-mode=dark]` …
 * Returns the same `{name,value}` shape as `extractCssVarPaletteHints`, role-
 * prioritized. Empty when no dark scope is found — fail-open, zero regression.
 *
 * This is intentionally a crude brace-balancing scanner rather than a full CSS
 * parser: it only needs to isolate the dark scopes and pull `--name: #hex`
 * declarations out of them, which a balanced-brace slice does reliably enough
 * for the marketing sites we import.
 */
export function extractDarkCssVarHints(
  $: cheerio.CheerioAPI,
  stylesheets: FetchedStylesheet[],
): { name: string; value: string }[] {
  const hexRe = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
  const found = new Map<string, string>();
  const darkSelectorRe = /(?:prefers-color-scheme\s*:\s*dark|\[data-theme\s*[~|]?=\s*["']?dark|\[data-mode\s*[~|]?=\s*["']?dark|\[data-color-mode\s*[~|]?=\s*["']?dark|(?:^|[\s,{>+~])(?:html|:root|body)?\.(?:dark|theme-dark|dark-mode)\b)/i;

  // Slice out the body of the brace-group that begins at `openIdx` (the index
  // of the `{`). Returns [body, indexAfterClosingBrace].
  const sliceBlock = (css: string, openIdx: number): [string, number] => {
    let depth = 0;
    for (let i = openIdx; i < css.length; i++) {
      const c = css[i];
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) return [css.slice(openIdx + 1, i), i + 1];
      }
    }
    return [css.slice(openIdx + 1), css.length];
  };

  const harvestDecls = (block: string): void => {
    const declRe = /(--[a-zA-Z0-9-]+)\s*:\s*([^;{}]+?)\s*(?:!important)?\s*[;}]/g;
    let m: RegExpExecArray | null;
    while ((m = declRe.exec(block))) {
      const name = m[1];
      // Same role gate as the light harvester so we only keep brand/role tokens.
      if (!/--(?:[a-z0-9]+-)*(?:brand|primary|secondary|accent|cta|link|button|bg|background|surface|card|text|fg|foreground|nav|border)(?:[-0-9a-z]*)?$/i.test(name)) continue;
      const value = m[2].trim();
      const hex = value.match(/#[0-9a-fA-F]{3,8}\b/)?.[0] ?? null;
      if (!hex) continue;
      const h = hex.replace("#", "");
      const expanded = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6);
      if (expanded.length !== 6 || !hexRe.test("#" + expanded)) continue;
      if (!found.has(name)) found.set(name, `#${expanded.toUpperCase()}`);
    }
  };

  const consume = (css: string): void => {
    if (!css) return;
    // Walk every `{` whose preceding selector/at-rule text matches a dark scope.
    // We look back to the previous `}` or `{` boundary for the selector text.
    let i = 0;
    let lastBoundary = 0;
    while (i < css.length) {
      const c = css[i];
      if (c === "{") {
        const selector = css.slice(lastBoundary, i);
        if (darkSelectorRe.test(selector)) {
          const [body, after] = sliceBlock(css, i);
          // For an @media block the body itself contains nested rules — harvest
          // every declaration inside; for a plain selector rule body is decls.
          harvestDecls(body);
          i = after;
          lastBoundary = after;
          continue;
        } else {
          // Skip this (non-dark) block wholesale so its nested vars don't leak.
          const [, after] = sliceBlock(css, i);
          i = after;
          lastBoundary = after;
          continue;
        }
      }
      if (c === "}") lastBoundary = i + 1;
      i++;
    }
  };

  $("style").each((_, el) => consume($(el).text() ?? ""));
  for (const s of stylesheets) consume(s.css);

  const PRIORITY = ["brand", "primary", "secondary", "accent", "cta", "link", "button", "nav", "surface", "card", "background", "bg", "foreground", "fg", "text", "border"];
  const rolePriority = (name: string): number => {
    const lower = name.toLowerCase();
    for (let i = 0; i < PRIORITY.length; i++) if (lower.includes(PRIORITY[i])) return i;
    return PRIORITY.length;
  };
  return [...found.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => rolePriority(a.name) - rolePriority(b.name))
    .slice(0, 24);
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

// ── Multi-page discovery (P0-1) ──────────────────────────────────────────────
// Priority keyword → rank. Lower rank = scraped sooner. Homepage is always
// rank 0; product/feature/pricing/customer/case/solution pages are the
// highest-signal companions for voice/content/photography.
const PAGE_PRIORITY: { re: RegExp; rank: number }[] = [
  { re: /^\/?$/, rank: 0 },
  { re: /\/(product|products|platform)(\/|$)/i, rank: 1 },
  { re: /\/(features?)(\/|$)/i, rank: 2 },
  { re: /\/(pricing|plans)(\/|$)/i, rank: 3 },
  { re: /\/(customers?|case-?stud|success|stories)(\/|$)/i, rank: 4 },
  { re: /\/(solutions?|use-?cases?)(\/|$)/i, rank: 5 },
  { re: /\/(about|company|who-we-are)(\/|$)/i, rank: 6 },
];
// Pages whose imagery is worth pulling rawHtml for (product/customer/case-study
// photography + testimonials). Used to pick which non-home pages get rawHtml.
const IMAGE_RICH_RE = /\/(product|products|platform|customers?|case-?stud|success|stories|solutions?|features?)(\/|$)/i;

function pathRank(pathname: string): number {
  const p = pathname.toLowerCase();
  for (const { re, rank } of PAGE_PRIORITY) if (re.test(p)) return rank;
  return 99;
}

// Static fallback when sitemap + nav discovery don't yield enough companions.
const STATIC_FALLBACK_PATHS = ["/", "/about", "/pricing", "/products", "/features", "/customers", "/solutions"];

async function fetchSitemapUrls(homeUrl: string): Promise<string[]> {
  let origin = "";
  try {
    origin = new URL(homeUrl).origin;
  } catch {
    return [];
  }
  const sitemapUrls = [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`];
  const out = new Set<string>();
  for (const sm of sitemapUrls) {
    if (!(await urlIsSafe(sm))) continue;
    try {
      const res = await fetchWithTimeout(
        sm,
        { headers: { "User-Agent": USER_AGENT, Accept: "application/xml,text/xml,*/*;q=0.1" } },
        SITEMAP_TIMEOUT_MS,
      );
      if (!res.ok) continue;
      const ct = res.headers.get("content-type") ?? "";
      if (!/xml|text/.test(ct)) continue;
      const body = (await res.text()).slice(0, 2_000_000);
      // <loc>…</loc> covers both urlset and sitemapindex. We don't recurse into
      // nested sitemaps (bounded cost); the homepage + top-level locs are enough
      // to surface product/customer/pricing companions on most marketing sites.
      const locRe = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
      let m: RegExpExecArray | null;
      while ((m = locRe.exec(body))) {
        out.add(m[1].trim());
        if (out.size >= 500) break;
      }
      if (out.size > 0) break; // first sitemap that yields URLs wins
    } catch {
      /* fail-open */
    }
  }
  return [...out];
}

function collectNavHrefs($: cheerio.CheerioAPI, homeUrl: string): string[] {
  const out = new Set<string>();
  let homeHost = "";
  try { homeHost = new URL(homeUrl).host; } catch { /* noop */ }
  $("header a, nav a").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const abs = safeJoinUrl(homeUrl, href);
    if (!abs) return;
    try { if (new URL(abs).host !== homeHost) return; } catch { return; }
    out.add(abs);
  });
  return [...out];
}

/**
 * Build the prioritized companion-page URL set: same-origin URLs from the
 * sitemap + homepage nav, ranked by PAGE_PRIORITY, deduped by pathname, capped
 * to (budget - 1) companions (the home page is added by the caller). Falls back
 * to STATIC_FALLBACK_PATHS when discovery is too thin. Returns same-origin
 * absolute URLs.
 */
function selectCompanionUrls(
  homeUrl: string,
  sitemapUrls: string[],
  navUrls: string[],
  budget: number,
): string[] {
  let homeOrigin = "";
  let homePath = "/";
  try {
    const u = new URL(homeUrl);
    homeOrigin = u.origin;
    homePath = u.pathname.replace(/\/+$/, "") || "/";
  } catch {
    return [];
  }
  const byPath = new Map<string, { url: string; rank: number }>();
  const consider = (raw: string): void => {
    let u: URL;
    try { u = new URL(raw, homeUrl); } catch { return; }
    if (u.origin !== homeOrigin) return;
    if (u.protocol !== "http:" && u.protocol !== "https:") return;
    const path = u.pathname.replace(/\/+$/, "") || "/";
    if (path === homePath) return; // home is handled separately
    // Skip deep/blog/legal/asset paths — low brand signal, high count.
    if (/\.(xml|json|pdf|jpg|jpeg|png|gif|svg|webp|css|js)$/i.test(path)) return;
    if (/\/(blog|news|press|legal|privacy|terms|cookie|login|signin|signup|account|cart|checkout|search|tag|tags|author|category)(\/|$)/i.test(path)) return;
    const segments = path.split("/").filter(Boolean).length;
    if (segments > 3) return; // avoid deep article URLs
    const rank = pathRank(path);
    if (rank >= 99) return; // only keep recognized high-signal companions
    const norm = `${homeOrigin}${path}`;
    const existing = byPath.get(path);
    if (!existing || rank < existing.rank) byPath.set(path, { url: norm, rank });
  };
  for (const u of sitemapUrls) consider(u);
  for (const u of navUrls) consider(u);

  let companions = [...byPath.values()].sort((a, b) => a.rank - b.rank).map((e) => e.url);

  // Fall back to a richer static list when discovery is thin.
  if (companions.length < Math.min(3, budget - 1)) {
    const have = new Set(companions.map((c) => { try { return new URL(c).pathname.replace(/\/+$/, "") || "/"; } catch { return c; } }));
    for (const p of STATIC_FALLBACK_PATHS) {
      const abs = safeJoinUrl(homeUrl, p);
      if (!abs) continue;
      let path = p;
      try { path = new URL(abs).pathname.replace(/\/+$/, "") || "/"; } catch { /* noop */ }
      if (path === homePath || have.has(path)) continue;
      have.add(path);
      companions.push(abs);
    }
  }
  return companions.slice(0, Math.max(0, budget - 1));
}

export async function buildEvidence(
  homeUrl: string,
  firecrawlApiKey: string,
): Promise<Evidence> {
  const buildStart = Date.now();
  // Discover companion pages: sitemap + homepage nav (via a quick direct fetch
  // of the home rawHtml, which we need anyway for the deterministic extractors).
  const directHtmlP = fetchRawHtmlDirect(homeUrl);
  const sitemapP = fetchSitemapUrls(homeUrl);
  const directHtmlEarly = await directHtmlP;
  const sitemapUrls = await sitemapP;
  const navUrls = directHtmlEarly ? collectNavHrefs(cheerio.load(directHtmlEarly), homeUrl) : [];
  const companionUrls = selectCompanionUrls(homeUrl, sitemapUrls, navUrls, MAX_CRAWL_PAGES);

  // Home first, then the prioritized companions.
  const candidateUrls = [homeUrl, ...companionUrls];
  const candidatePaths = candidateUrls
    .map((u) => { try { return new URL(u).pathname.replace(/\/+$/, "") || "/"; } catch { return null; } })
    .filter((p): p is string => !!p);

  const robots = await fetchRobotsVerdict(homeUrl, candidatePaths, ROBOTS_TIMEOUT_MS);
  const allowedCandidates = candidateUrls.filter((u) => {
    try {
      const p = new URL(u).pathname.replace(/\/+$/, "") || "/";
      const matchPath = p === "/" ? "/" : p;
      return robots.allowed[matchPath] !== false;
    } catch {
      return true;
    }
  });

  // Pick the (non-home) image-rich companion pages that should additionally
  // fetch rawHtml so photography + content see their product/testimonial
  // imagery and copy — bounded by MAX_EXTRA_RAWHTML.
  const rawHtmlPaths = new Set<string>();
  for (const u of allowedCandidates.slice(1)) {
    if (rawHtmlPaths.size >= MAX_EXTRA_RAWHTML) break;
    try {
      if (IMAGE_RICH_RE.test(new URL(u).pathname)) rawHtmlPaths.add(u);
    } catch { /* noop */ }
  }

  // Home keeps markdown + screenshot + rawHtml; companions get markdown, plus
  // rawHtml for the chosen image-rich pages. All scrapes run in PARALLEL behind
  // the Firecrawl semaphore. Fail-open: a failed/timed-out page is dropped.
  const scrapePromises = allowedCandidates.map(async (u, i) => {
    const t0 = Date.now();
    const r = await firecrawlScrape(firecrawlApiKey, u, {
      withScreenshot: i === 0,
      withRawHtml: i === 0 || rawHtmlPaths.has(u),
    });
    logger.info(
      { event: "brand_import_page_scrape", url: u, status: r ? "ok" : "failed", durationMs: Date.now() - t0, isHome: i === 0, withRawHtml: i === 0 || rawHtmlPaths.has(u) },
      "[brand-import] page scrape",
    );
    return r;
  });
  const scrapes = (await Promise.all(scrapePromises)).filter((s): s is FirecrawlResult => !!s);

  const pages: ScrapedPage[] = scrapes.map((s) => ({
    url: s.url,
    markdown: s.markdown,
    rawHtml: s.rawHtml,
    screenshotUrl: s.screenshotUrl,
    fetchedAt: Date.now(),
  }));

  // Backfill home rawHtml from the direct fetch if firecrawl didn't return it.
  const directHtml = directHtmlEarly;
  const home = pages[0];
  if (home && !home.rawHtml && directHtml) {
    home.rawHtml = directHtml;
  } else if (!home && directHtml) {
    pages.unshift({
      url: homeUrl,
      markdown: "",
      rawHtml: directHtml,
      screenshotUrl: null,
      fetchedAt: Date.now(),
    });
  }

  const errors: string[] = [];
  if (!pages.length) errors.push("evidence: no pages scraped");

  // Prefer the actual home page's rawHtml for the deterministic extractors
  // (nav/logo/CSS-var colors must come from the homepage, not a companion).
  // Fall back to any page's rawHtml only if home failed entirely.
  const homePage = pages.find((p) => {
    try { return (new URL(p.url).pathname.replace(/\/+$/, "") || "/") === (new URL(homeUrl).pathname.replace(/\/+$/, "") || "/"); }
    catch { return false; }
  });
  const homeRaw = homePage?.rawHtml ?? pages.find((p) => p.rawHtml)?.rawHtml ?? null;
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
  const darkCssVarHints = $home ? extractDarkCssVarHints($home, stylesheets) : [];

  // Reliability fallback: only when both preferred color sources came up empty
  // (no screenshot palette AND no named CSS vars) do we harvest raw declared
  // colors from CSS/inline styles, so the color extractor has something to
  // work with instead of hard-failing. We never override a real screenshot
  // palette with this lower-quality signal.
  if (!sampledPalette.length && !cssVarPaletteHints.length && $home) {
    const harvested = harvestCssColorHints($home, stylesheets);
    if (harvested.length) sampledPalette = harvested;
  }

  logger.info(
    {
      event: "brand_import_evidence_built",
      homeUrl,
      durationMs: Date.now() - buildStart,
      candidatesConsidered: candidateUrls.length,
      companionsDiscovered: companionUrls.length,
      sitemapUrls: sitemapUrls.length,
      navUrls: navUrls.length,
      pagesScraped: pages.length,
      pageUrls: pages.map((p) => p.url),
      pagesWithRawHtml: pages.filter((p) => p.rawHtml).length,
      hasScreenshot: !!screenshotUrl,
      sampledPaletteLen: sampledPalette.length,
      cssVarHints: cssVarPaletteHints.length,
    },
    "[brand-import] evidence built",
  );

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
    darkCssVarHints,
    errors,
  };
}
