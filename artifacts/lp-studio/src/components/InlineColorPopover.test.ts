import { describe, expect, it } from "vitest";

import { dedupeRecents } from "./InlineColorPopover";

/**
 * Regression guard for the inline color picker's "Recent" swatches. The same
 * color saved with different letter casing (e.g. `#ABCDEF` vs `#abcdef`) used
 * to appear twice, which produced duplicate React keys, flooded the console
 * with warnings, and could make swatches render the wrong color or vanish.
 * `dedupeRecents` collapses case-insensitive duplicates; these tests keep that
 * behavior — and the key-uniqueness it guarantees — from silently regressing.
 */
describe("dedupeRecents", () => {
  it("collapses mixed-case duplicates of the same hex to one entry", () => {
    expect(dedupeRecents(["#ABCDEF", "#abcdef"])).toEqual(["#ABCDEF"]);
  });

  it("collapses repeated identical hexes to one entry", () => {
    expect(dedupeRecents(["#123456", "#123456", "#123456"])).toEqual([
      "#123456",
    ]);
  });

  it("keeps the first (most-recent) casing of a duplicate", () => {
    // The most-recently-applied color is prepended, so its casing wins.
    expect(dedupeRecents(["#AaBbCc", "#aabbcc", "#AABBCC"])).toEqual([
      "#AaBbCc",
    ]);
  });

  it("preserves the order of distinct colors", () => {
    expect(
      dedupeRecents(["#111111", "#222222", "#333333"]),
    ).toEqual(["#111111", "#222222", "#333333"]);
  });

  it("dedupes while preserving order across interleaved duplicates", () => {
    expect(
      dedupeRecents(["#111111", "#AAAAAA", "#111111", "#aaaaaa", "#222222"]),
    ).toEqual(["#111111", "#AAAAAA", "#222222"]);
  });

  it("returns an empty list unchanged", () => {
    expect(dedupeRecents([])).toEqual([]);
  });

  it("guarantees case-insensitively unique values after dedupe", () => {
    // Helper-level invariant (not a render assertion): the recents swatches
    // are keyed off each value's lower-cased form, so the root cause of the
    // duplicate-key bug was two entries sharing a case-insensitive value.
    // After dedupe, every lower-cased value must be unique, which is what
    // keeps the component's React keys collision-free.
    const deduped = dedupeRecents([
      "#FF0000",
      "#ff0000",
      "#00FF00",
      "#00ff00",
      "#0000FF",
    ]);
    const keys = deduped.map((v) => v.toLowerCase());
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toEqual(["#ff0000", "#00ff00", "#0000ff"]);
  });
});
