/**
 * Real page-speed measurement via Google PageSpeed Insights (PSI / Lighthouse).
 *
 * The conversion scorer's "Page Speed Impact" category was historically a
 * structural proxy (penalize by block + image count). That means a genuinely
 * slow page and a fast page with the same layout score identically. This module
 * fetches a *measured* Lighthouse performance score for the published page and
 * caches it, so the scorer can use a real number when one is available and fall
 * back to the structural proxy when it is not.
 *
 * Design constraints that shape this file:
 *   - PSI calls are slow (10-30s) and rate-limited, so we NEVER block a scoring
 *     request on a fetch. The scoring route reads whatever is cached and, when
 *     the cache is stale/missing for a published page, kicks off a background
 *     refresh that populates the cache for the *next* request.
 *   - No schema change: the cache is in-process with a TTL. A fresh process
 *     simply falls back to the structural proxy until the first background
 *     measurement lands. That degradation is graceful and intentional.
 *   - Only published pages have a publicly reachable URL that Google can crawl,
 *     so drafts always return null (→ structural proxy).
 */
import { getActiveHostsForTenant, WILDCARD_BASE_HOSTS } from "./tenantHosts";

/** How long a measured score is considered fresh before a background refresh. */
const TTL_MS = 24 * 60 * 60 * 1000; // 24h
/** Backoff after a failed fetch so we don't hammer PSI on a broken page. */
const FAILURE_BACKOFF_MS = 60 * 60 * 1000; // 1h
/** Hard cap on a single PSI request so a slow run can't pin a socket. */
const FETCH_TIMEOUT_MS = 30 * 1000;

const PSI_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

interface CacheEntry {
  /** Measured Lighthouse performance score 0-100, or null if the last attempt failed. */
  score: number | null;
  /** epoch ms of the last completed attempt (success or failure). */
  fetchedAt: number;
  /** Guards against launching overlapping fetches for the same page. */
  inFlight: boolean;
}

const cache = new Map<number, CacheEntry>();

export interface SpeedScorePage {
  id: number;
  tenantId: number;
  slug: string;
  status: string;
}

/**
 * Extract the Lighthouse performance score (0-100) from a PSI v5 response.
 * Pure + exported so the mapping is unit-testable without a network call.
 * Returns null when the payload is missing the performance category.
 */
export function extractPerformanceScore(psiJson: unknown): number | null {
  if (!psiJson || typeof psiJson !== "object") return null;
  const lighthouse = (psiJson as Record<string, unknown>).lighthouseResult;
  if (!lighthouse || typeof lighthouse !== "object") return null;
  const categories = (lighthouse as Record<string, unknown>).categories;
  if (!categories || typeof categories !== "object") return null;
  const performance = (categories as Record<string, unknown>).performance;
  if (!performance || typeof performance !== "object") return null;
  const raw = (performance as Record<string, unknown>).score;
  // Lighthouse reports performance.score as a 0-1 float (or null when it could
  // not be computed). Anything else is not a usable measurement.
  if (typeof raw !== "number" || Number.isNaN(raw)) return null;
  return Math.max(0, Math.min(100, Math.round(raw * 100)));
}

/**
 * Build the public, externally-crawlable URL for a published page. Prefers a
 * wildcard subdomain we always control (served via the published-snapshot
 * pipeline at `/lp/<slug>`); falls back to a custom/microsite host at
 * `/<slug>`. Returns null when the tenant has no resolvable host.
 */
async function buildPublicPageUrl(page: SpeedScorePage): Promise<string | null> {
  const hosts = await getActiveHostsForTenant(page.tenantId);
  if (hosts.length === 0) return null;
  const isWildcard = (h: string) => WILDCARD_BASE_HOSTS.some(base => h === base || h.endsWith(`.${base}`));
  const wildcard = hosts.find(isWildcard);
  if (wildcard) return `https://${wildcard}/lp/${page.slug}`;
  // Custom / microsite host serves published pages at the bare slug path.
  return `https://${hosts[0]}/${page.slug}`;
}

/** True in environments where a live PSI call is pointless or undesirable. */
function fetchDisabled(): boolean {
  return (
    process.env.NODE_ENV === "test" ||
    process.env.VITEST === "true" ||
    process.env.DISABLE_PAGESPEED_INSIGHTS === "true"
  );
}

async function fetchPsiScore(url: string): Promise<number | null> {
  const params = new URLSearchParams({
    url,
    category: "performance",
    strategy: "mobile",
  });
  // PSI works anonymously (with tight rate limits); a key raises the quota.
  const key = process.env.PAGESPEED_API_KEY?.trim();
  if (key) params.set("key", key);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${PSI_ENDPOINT}?${params.toString()}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return extractPerformanceScore(json);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function refreshInBackground(page: SpeedScorePage, entry: CacheEntry): void {
  entry.inFlight = true;
  void (async () => {
    let score: number | null = null;
    try {
      const url = await buildPublicPageUrl(page);
      if (url) score = await fetchPsiScore(url);
    } catch {
      score = null;
    } finally {
      // Preserve a previously-good score if the refresh failed, so a transient
      // PSI hiccup doesn't drop us back to the structural proxy.
      const prev = cache.get(page.id);
      cache.set(page.id, {
        score: score ?? prev?.score ?? null,
        fetchedAt: Date.now(),
        inFlight: false,
      });
    }
  })();
}

/**
 * Return the most recent measured page-speed score (0-100) for a page, or null
 * when no measurement is available yet (→ caller falls back to the structural
 * proxy). Never blocks: when the cached value is stale or missing for a
 * published page, this schedules a background refresh and returns immediately
 * with whatever is currently cached.
 */
export function getMeasuredSpeedScore(page: SpeedScorePage): number | null {
  // Only published pages have a public URL Google can crawl.
  if (page.status !== "published") return null;

  const entry = cache.get(page.id);
  const now = Date.now();
  const isFresh = entry && now - entry.fetchedAt < TTL_MS;
  const isBackingOff = entry && entry.score === null && now - entry.fetchedAt < FAILURE_BACKOFF_MS;

  if (!fetchDisabled() && (!entry || (!isFresh && !isBackingOff)) && !entry?.inFlight) {
    const working = entry ?? { score: null, fetchedAt: 0, inFlight: false };
    if (!entry) cache.set(page.id, working);
    refreshInBackground(page, working);
  }

  return entry?.score ?? null;
}

/** Test-only: clear the in-process cache between cases. */
export function __clearSpeedScoreCache(): void {
  cache.clear();
}
