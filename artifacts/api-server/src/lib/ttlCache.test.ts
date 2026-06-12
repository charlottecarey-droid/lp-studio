import { describe, expect, it } from "vitest";
import { TtlCache } from "./ttlCache";

/** Build a cache with a controllable clock. */
function makeCache<V>(opts: { ttlMs: number; maxEntries: number }) {
  let t = 0;
  const cache = new TtlCache<V>({ ...opts, now: () => t });
  return {
    cache,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

describe("TtlCache", () => {
  it("returns a stored value within the TTL (hit)", () => {
    const { cache, advance } = makeCache<string>({ ttlMs: 1000, maxEntries: 10 });
    cache.set("a", "alpha");
    advance(999);
    expect(cache.get("a")).toBe("alpha");
    expect(cache.size).toBe(1);
  });

  it("returns undefined for a missing key", () => {
    const { cache } = makeCache<string>({ ttlMs: 1000, maxEntries: 10 });
    expect(cache.get("missing")).toBeUndefined();
  });

  it("expires entries after the TTL and deletes them on read", () => {
    const { cache, advance } = makeCache<string>({ ttlMs: 1000, maxEntries: 10 });
    cache.set("a", "alpha");
    advance(1000);
    expect(cache.get("a")).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it("overwriting a key refreshes its value and timestamp", () => {
    const { cache, advance } = makeCache<string>({ ttlMs: 1000, maxEntries: 10 });
    cache.set("a", "old");
    advance(900);
    cache.set("a", "new");
    advance(900); // 1800 since first set, 900 since overwrite
    expect(cache.get("a")).toBe("new");
  });

  it("evicts the least-recently-used entry beyond maxEntries", () => {
    const { cache } = makeCache<number>({ ttlMs: 1000, maxEntries: 3 });
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);
    cache.set("d", 4); // exceeds cap → "a" (oldest) evicted
    expect(cache.size).toBe(3);
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe(2);
    expect(cache.get("d")).toBe(4);
  });

  it("a get() refreshes recency so the read entry survives eviction", () => {
    const { cache } = makeCache<number>({ ttlMs: 1000, maxEntries: 3 });
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);
    expect(cache.get("a")).toBe(1); // touch "a" → "b" is now the LRU entry
    cache.set("d", 4);
    expect(cache.get("a")).toBe(1);
    expect(cache.get("b")).toBeUndefined();
  });

  it("clear() empties the cache", () => {
    const { cache } = makeCache<number>({ ttlMs: 1000, maxEntries: 3 });
    cache.set("a", 1);
    cache.set("b", 2);
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get("a")).toBeUndefined();
  });
});
