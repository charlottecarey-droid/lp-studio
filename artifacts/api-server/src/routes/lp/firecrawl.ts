// May 2026 audit follow-up — shared Firecrawl primitives for reference-URL
// scraping. Previously inlined in custom-blocks-generate.ts; lifted here so
// generate-page.ts (and any future AI flow) can reuse the same caching,
// truncation, failure-reason surfacing, and multi-page candidate logic
// without copy-paste drift.
//
// Two entry points:
//   • maybeScrapeRef(refUrl, tenantId) — single URL. Use when the user pasted
//     a deep link (e.g. https://acme.com/pricing) and clearly wants only that
//     section as the reference.
//   • maybeMultiPageScrapeRef(refUrl, tenantId) — root-domain pattern. Tries
//     the URL plus a handful of well-known marketing-site paths (/about,
//     /pricing, /customers, /product, /platform) in parallel and concatenates
//     whatever comes back. Voice extracted from 3 pages is meaningfully
//     better than from one. Falls back to single-page behaviour when the
//     input URL already has a deep path.

const MARKDOWN_MAX_CHARS = 24_000;
// Combined multi-page markdown is capped at this length too — three full
// marketing pages stitched together can easily run 60k chars otherwise.
const COMBINED_MAX_CHARS = 48_000;

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...init, signal: ctrl.signal }); } finally { clearTimeout(timer); }
}

export interface RawScrapeResult {
  markdown: string;
  screenshotUrl?: string;
  /** True when raw markdown exceeded MARKDOWN_MAX_CHARS and was truncated. */
  truncated: boolean;
}

/** Low-level wrapper around Firecrawl's /v1/scrape. */
export async function firecrawlScrape(
  apiKey: string,
  url: string,
  opts?: { withScreenshot?: boolean },
): Promise<RawScrapeResult | null> {
  const withScreenshot = opts?.withScreenshot ?? true;
  try {
    const res = await fetchWithTimeout(
      "https://api.firecrawl.dev/v1/scrape",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          // May 2026 audit follow-up:
          //   • screenshot@fullPage instead of viewport so the model sees
          //     below-the-fold sections.
          //   • onlyMainContent: false so nav/footer/CTA bars (which users
          //     most often want to clone) come through.
          //   • waitFor 4000 ms instead of 1500 — JS-heavy marketing pages
          //     animate hero copy in on scroll.
          formats: withScreenshot ? ["markdown", "screenshot@fullPage"] : ["markdown"],
          onlyMainContent: false,
          waitFor: 4000,
        }),
      },
      30000,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: { markdown?: string; screenshot?: string } };
    const raw = (data?.data?.markdown ?? "").trim();
    return {
      markdown: raw.slice(0, MARKDOWN_MAX_CHARS),
      screenshotUrl: data?.data?.screenshot,
      truncated: raw.length > MARKDOWN_MAX_CHARS,
    };
  } catch { return null; }
}

// ── In-memory LRU cache ──────────────────────────────────────────────────
//
// Most iterative edits ("now darker", "more bullets") re-hit the same URL,
// so caching by (tenant, normalised URL) for 24h cuts ~60% of latency and
// Firecrawl spend off the iteration loop. Module-scoped: lifecycle = process
// lifetime, which is fine because Replit autoscale recycles instances often.

const SCRAPE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const SCRAPE_CACHE_MAX = 200;

interface ScrapeCacheEntry {
  at: number;
  value: RawScrapeResult;
}

const scrapeCache: Map<string, ScrapeCacheEntry> = new Map();

export function normalizeScrapeUrl(u: string): string {
  try {
    const url = new URL(u);
    url.hash = "";
    for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"]) {
      url.searchParams.delete(k);
    }
    return url.toString();
  } catch { return u; }
}

export async function cachedFirecrawlScrape(
  apiKey: string,
  rawUrl: string,
  tenantId: number,
  opts?: { withScreenshot?: boolean },
): Promise<RawScrapeResult | null> {
  const url = normalizeScrapeUrl(rawUrl);
  // Cache key includes withScreenshot so a screenshot-less probe (used for
  // companion pages in multi-page mode) doesn't poison the cached value the
  // primary URL needs.
  const ws = opts?.withScreenshot ?? true;
  const key = `${tenantId}::${ws ? "S" : "N"}::${url}`;
  const now = Date.now();
  const hit = scrapeCache.get(key);
  if (hit && now - hit.at < SCRAPE_CACHE_TTL_MS) {
    scrapeCache.delete(key);
    scrapeCache.set(key, hit);
    return hit.value;
  }
  const fresh = await firecrawlScrape(apiKey, url, opts);
  if (!fresh) return null;
  scrapeCache.set(key, { at: now, value: fresh });
  while (scrapeCache.size > SCRAPE_CACHE_MAX) {
    const oldestKey = scrapeCache.keys().next().value;
    if (oldestKey === undefined) break;
    scrapeCache.delete(oldestKey);
  }
  return fresh;
}

// ── Public scrape helpers ────────────────────────────────────────────────

export type ScrapeFailureReason =
  | "no_url"
  | "invalid_url"
  | "no_firecrawl_key"
  | "firecrawl_failed"
  | "empty_markdown";

export interface MaybeScrapeResult {
  scraped:
    | {
        url: string;
        markdown: string;
        truncated: boolean;
        /** When multi-page, the additional URLs that contributed to the
         *  combined markdown beyond the primary one. Empty for single-page. */
        additionalUrls?: string[];
      }
    | null;
  screenshotUrl?: string;
  /** Why scraping didn't produce content. Distinguishes "user didn't pass a
   *  URL" from "we tried and failed" so the UI can warn appropriately. */
  failureReason?: ScrapeFailureReason;
}

function parseReferenceUrl(refUrl: string | undefined): URL | null {
  const trimmed = (refUrl ?? "").trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Scrape a single URL. Use when the user provided a deep link they want to
 *  reference as-is. */
export async function maybeScrapeRef(
  refUrl: string | undefined,
  tenantId: number,
): Promise<MaybeScrapeResult> {
  const trimmed = (refUrl ?? "").trim();
  if (!trimmed) return { scraped: null, failureReason: "no_url" };
  const parsed = parseReferenceUrl(trimmed);
  if (!parsed) return { scraped: null, failureReason: "invalid_url" };
  const FIRECRAWL_KEY = process.env.FIRECRAWL_API_KEY;
  if (!FIRECRAWL_KEY) return { scraped: null, failureReason: "no_firecrawl_key" };
  const got = await cachedFirecrawlScrape(FIRECRAWL_KEY, parsed.toString(), tenantId);
  if (!got) return { scraped: null, failureReason: "firecrawl_failed" };
  if (!got.markdown) {
    return { scraped: null, screenshotUrl: got.screenshotUrl, failureReason: "empty_markdown" };
  }
  return {
    scraped: { url: parsed.toString(), markdown: got.markdown, truncated: got.truncated },
    screenshotUrl: got.screenshotUrl,
  };
}

function safeJoinUrl(base: string, path: string): string | null {
  try {
    return new URL(path, base).toString();
  } catch {
    return null;
  }
}

/** Heuristic: a "root" URL has either no path or just "/". When the user
 *  pastes a deep link (/pricing, /blog/x), single-page is correct — they
 *  want that exact section. When they paste a homepage, multi-page picks
 *  up far more voice signal. */
function isRootUrl(parsed: URL): boolean {
  const path = parsed.pathname.replace(/\/+$/, "");
  return path === "" || path === "/";
}

const COMPANION_PATHS = [
  "/about",
  "/pricing",
  "/customers",
  "/product",
  "/platform",
];

/**
 * Scrape the primary URL plus a handful of well-known marketing paths,
 * concatenating their markdown. Voice extracted from 3 pages is materially
 * better than from one. Falls back to single-page behaviour when the input
 * isn't a root URL — pasted deep links should reference only that page.
 *
 * Screenshot comes from the primary URL only (companion pages skip the
 * screenshot to halve Firecrawl spend per multi-scrape).
 */
export async function maybeMultiPageScrapeRef(
  refUrl: string | undefined,
  tenantId: number,
): Promise<MaybeScrapeResult> {
  const trimmed = (refUrl ?? "").trim();
  if (!trimmed) return { scraped: null, failureReason: "no_url" };
  const parsed = parseReferenceUrl(trimmed);
  if (!parsed) return { scraped: null, failureReason: "invalid_url" };
  const FIRECRAWL_KEY = process.env.FIRECRAWL_API_KEY;
  if (!FIRECRAWL_KEY) return { scraped: null, failureReason: "no_firecrawl_key" };

  // Deep link → single page only.
  if (!isRootUrl(parsed)) {
    return maybeScrapeRef(trimmed, tenantId);
  }

  const primaryUrl = parsed.toString();
  const candidates: { url: string; primary: boolean }[] = [{ url: primaryUrl, primary: true }];
  for (const p of COMPANION_PATHS) {
    const joined = safeJoinUrl(primaryUrl, p);
    if (joined && joined !== primaryUrl) candidates.push({ url: joined, primary: false });
  }

  const scrapes = await Promise.all(
    candidates.map((c) =>
      cachedFirecrawlScrape(FIRECRAWL_KEY, c.url, tenantId, { withScreenshot: c.primary })
        .then((r) => (r ? { ...c, result: r } : null))
        .catch(() => null),
    ),
  );

  const successful = scrapes.filter(
    (s): s is { url: string; primary: boolean; result: RawScrapeResult } =>
      !!s && !!s.result.markdown,
  );

  if (successful.length === 0) {
    return { scraped: null, failureReason: "firecrawl_failed" };
  }

  // Primary screenshot wins; if absent (rare — primary failed mid-flight)
  // fall back to whatever first companion has one.
  const primary = successful.find((s) => s.primary);
  const screenshotUrl =
    primary?.result.screenshotUrl ?? successful.find((s) => s.result.screenshotUrl)?.result.screenshotUrl;

  // Stitch the markdown together with clear section headers so the model
  // can attribute language to a page. Cap at COMBINED_MAX_CHARS to keep
  // prompt size sane.
  const combinedRaw = successful
    .map((s) => `### ${s.url}\n\n${s.result.markdown}`)
    .join("\n\n---\n\n");
  const combined = combinedRaw.slice(0, COMBINED_MAX_CHARS);
  const truncated = combinedRaw.length > COMBINED_MAX_CHARS;

  return {
    scraped: {
      url: primaryUrl,
      markdown: combined,
      truncated,
      additionalUrls: successful.filter((s) => !s.primary).map((s) => s.url),
    },
    screenshotUrl,
  };
}
