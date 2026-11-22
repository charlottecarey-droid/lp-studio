import { describe, it, expect } from "vitest";
import { isAppBuildStale, isSnapshotStale } from "./snapshotReconcile";
import { extractAppBuildId, getCurrentAppBuildId, resetAppBuildCacheForTests } from "./appBuild";

const CURRENT = "2026-05-31.1";

describe("isSnapshotStale", () => {
  it("is not stale when every host snapshot is at the current version", () => {
    expect(isSnapshotStale({ "a.example.com": CURRENT }, CURRENT)).toBe(false);
    expect(
      isSnapshotStale({ "a.example.com": CURRENT, "b.example.com": CURRENT }, CURRENT),
    ).toBe(false);
  });

  it("is stale when a snapshot carries an older/different version", () => {
    expect(isSnapshotStale({ "a.example.com": "2026-01-01.1" }, CURRENT)).toBe(true);
  });

  it("is stale when a snapshot is unstamped (baked before render-version existed)", () => {
    // null = object exists but has no render-version metadata.
    expect(isSnapshotStale({ "a.example.com": null }, CURRENT)).toBe(true);
  });

  it("is stale when ANY one host is behind even if others are current", () => {
    expect(
      isSnapshotStale(
        { "a.example.com": CURRENT, "b.example.com": null },
        CURRENT,
      ),
    ).toBe(true);
    expect(
      isSnapshotStale(
        { "a.example.com": CURRENT, "b.example.com": "old" },
        CURRENT,
      ),
    ).toBe(true);
  });

  it("is not stale when there are no active hosts (nothing to reconcile)", () => {
    expect(isSnapshotStale({}, CURRENT)).toBe(false);
  });
});

describe("app-like pages follow the live app build", () => {
  it("reads the entry script a page loads", () => {
    expect(extractAppBuildId('<script type="module" crossorigin src="/assets/index-BbSrA3-X.js"></script><link href="/assets/vendor-ui-DOSbO6rR.js">')).toBe("index-BbSrA3-X.js");
    expect(extractAppBuildId("<html><body>no app here</body></html>")).toBeNull();
  });

  it("is stale when any host loads another build, or carries no stamp", () => {
    expect(isAppBuildStale({ "a.example.com": "index-new.js" }, "index-new.js")).toBe(false);
    expect(isAppBuildStale({ "a.example.com": "index-old.js" }, "index-new.js")).toBe(true);
    expect(isAppBuildStale({ "a.example.com": "index-new.js", "b.example.com": null }, "index-new.js")).toBe(true);
  });

  it("never re-bakes on a guess: an unreadable live build means not stale", () => {
    expect(isAppBuildStale({ "a.example.com": "index-old.js" }, null)).toBe(false);
  });

  it("reads the live build from the app shell, and retries after a failed read", async () => {
    resetAppBuildCacheForTests();
    const ok = (async () => new Response('<script src="/assets/index-LIVE123.js"></script>')) as unknown as typeof fetch;
    const down = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
    expect(await getCurrentAppBuildId({ fetchImpl: down, now: 0 })).toBeNull();
    expect(await getCurrentAppBuildId({ fetchImpl: ok, now: 1 })).toBe("index-LIVE123.js");
    // Cached for a few minutes.
    expect(await getCurrentAppBuildId({ fetchImpl: down, now: 2 })).toBe("index-LIVE123.js");
    resetAppBuildCacheForTests();
  });
});
