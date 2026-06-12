/**
 * Small in-process TTL + LRU cache.
 *
 * Extracted as a standalone helper (June 2026) so the inspiration-URL scrape
 * cache in routes/lp/firecrawl.ts is unit-testable, and so future per-process
 * caches (the codebase already hand-rolls this pattern in tenantHosts.ts and
 * firecrawl.ts's scrapeCache) have one tested implementation to reach for.
 *
 * Semantics:
 *   • `get` returns `undefined` for a missing OR expired entry (expired
 *     entries are deleted on read) and refreshes the entry's LRU recency on a
 *     hit (Map insertion order doubles as the recency list).
 *   • `set` inserts/overwrites, then evicts the least-recently-used entries
 *     until the cache is within `maxEntries`.
 *   • Module-level instances live for the process lifetime — fine for
 *     autoscaled deployments that recycle instances regularly.
 *
 * `now` is injectable for tests; defaults to Date.now.
 */
export interface TtlCacheOptions {
  /** Entry lifetime in milliseconds. */
  ttlMs: number;
  /** Maximum number of entries kept; least-recently-used evicted beyond it. */
  maxEntries: number;
  /** Clock override for tests. */
  now?: () => number;
}

interface TtlCacheEntry<V> {
  at: number;
  value: V;
}

export class TtlCache<V> {
  private readonly map = new Map<string, TtlCacheEntry<V>>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;

  constructor(opts: TtlCacheOptions) {
    this.ttlMs = opts.ttlMs;
    this.maxEntries = Math.max(1, opts.maxEntries);
    this.now = opts.now ?? Date.now;
  }

  get(key: string): V | undefined {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (this.now() - hit.at >= this.ttlMs) {
      this.map.delete(key);
      return undefined;
    }
    // Refresh recency: Map iteration order is insertion order, so re-inserting
    // moves the entry to the most-recently-used end.
    this.map.delete(key);
    this.map.set(key, hit);
    return hit.value;
  }

  set(key: string, value: V): void {
    this.map.delete(key);
    this.map.set(key, { at: this.now(), value });
    while (this.map.size > this.maxEntries) {
      const oldestKey = this.map.keys().next().value;
      if (oldestKey === undefined) break;
      this.map.delete(oldestKey);
    }
  }

  delete(key: string): void {
    this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}
