/**
 * Apollo IP Reveal — identifies the company behind an IP address.
 * Uses Apollo's /organizations/reveal endpoint.
 *
 * Results are cached in-memory for 10 minutes per IP to avoid hammering
 * the API on every page load from the same visitor.
 */

const APOLLO_API_URL = "https://api.apollo.io/v1/organizations/reveal";
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface CacheEntry {
  name: string;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function getCached(ip: string): string | null {
  const entry = cache.get(ip);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(ip);
    return null;
  }
  return entry.name;
}

function setCached(ip: string, name: string): void {
  cache.set(ip, { name, expiresAt: Date.now() + CACHE_TTL_MS });
  // Prevent unbounded growth — evict oldest entries when cache exceeds 500 IPs
  if (cache.size > 500) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
}

/**
 * Returns the company name for the given IP, or an empty string if unknown.
 * Never throws — callers can always treat the result as a best-effort value.
 */
export async function revealAccountName(ip: string): Promise<string> {
  if (!ip || ip === "127.0.0.1" || ip === "::1") return "";

  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) return "";

  const cached = getCached(ip);
  if (cached !== null) return cached;

  try {
    const url = `${APOLLO_API_URL}?ip=${encodeURIComponent(ip)}`;
    const res = await fetch(url, {
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(3000), // 3 s max — don't slow down page loads
    });

    if (!res.ok) {
      setCached(ip, "");
      return "";
    }

    const data = await res.json() as { organization?: { name?: string } };
    const name = data?.organization?.name?.trim() ?? "";
    setCached(ip, name);
    return name;
  } catch {
    setCached(ip, "");
    return "";
  }
}
