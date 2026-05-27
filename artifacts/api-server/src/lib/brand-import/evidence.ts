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

const FIRECRAWL_TIMEOUT_MS = 6000;
const RAW_HTML_TIMEOUT_MS = 5000;
const STYLESHEET_TIMEOUT_MS = 4000;
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
      FIRECRAWL_TIMEOUT_MS,
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
    const t = setTimeout(() => ctl.abort(), 8000);
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
    const out: string[] = [];
    const seen = new Set<string>();
    for (const [key] of sorted) {
      const r = ((key >> 8) & 0xf) * STEP + STEP / 2;
      const g = ((key >> 4) & 0xf) * STEP + STEP / 2;
      const b = (key & 0xf) * STEP + STEP / 2;
      const hex = `#${[r, g, b].map((c) => Math.min(255, Math.round(c)).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
      if (seen.has(hex)) continue;
      seen.add(hex);
      out.push(hex);
      if (out.length >= 12) break;
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

  const robotsP = fetchRobotsVerdict(homeUrl, candidatePaths);
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
  const sampledPalette = screenshotFetch ? await samplePaletteFromBuffer(screenshotFetch.buf) : [];
  // Inline as data: URL — OpenAI's fetcher gets blocked/throttled by some
  // firecrawl screenshot hosts; passing the bytes directly avoids that.
  const screenshotDataUrl = screenshotFetch
    ? `data:${screenshotFetch.contentType};base64,${screenshotFetch.buf.toString("base64")}`
    : null;
  const cssVarPaletteHints = $home ? extractCssVarPaletteHints($home, stylesheets) : [];

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
