import { describe, it, expect } from "vitest";
import { isSnapshotStale } from "./snapshotReconcile";

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
