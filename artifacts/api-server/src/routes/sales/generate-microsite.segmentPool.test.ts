import { describe, it, expect } from "vitest";
import {
  resolveMicrositeBlockSource,
  segmentPoolAllowedSet,
  buildSegmentPoolBlockGuide,
} from "./generate-microsite";
import { canonicalizeBlockType } from "../../lib/ai-prompts/block-aliases";

// `mega-menu-nav` is a real block type outside the structural essentials, a
// clean stand-in for a block a tenant approved for a segment.
const EXTRA = "mega-menu-nav";

function bulletTypes(guide: string): string[] {
  return [...guide.matchAll(/^- "([a-z0-9-]+)"/gm)].map((m) => m[1]);
}

describe("resolveMicrositeBlockSource — precedence", () => {
  const base = {
    hasTemplate: false,
    dsoFreeformMode: null,
    hasSegmentLock: false,
    hasSegmentPool: false,
    hasBrandDefault: false,
  } as const;

  it("template wins over everything", () => {
    expect(
      resolveMicrositeBlockSource({
        ...base,
        hasTemplate: true,
        dsoFreeformMode: "enterprise",
        hasSegmentLock: true,
        hasSegmentPool: true,
        hasBrandDefault: true,
      }),
    ).toBe("template");
  });

  it("dso-freeform beats lock/pool/brand-default", () => {
    expect(
      resolveMicrositeBlockSource({
        ...base,
        dsoFreeformMode: "practices",
        hasSegmentLock: true,
        hasSegmentPool: true,
        hasBrandDefault: true,
      }),
    ).toBe("dso-freeform");
  });

  it("an explicit segment lock is honored OVER the approved pool", () => {
    expect(
      resolveMicrositeBlockSource({
        ...base,
        hasSegmentLock: true,
        hasSegmentPool: true,
        hasBrandDefault: true,
      }),
    ).toBe("segment-lock");
  });

  it("the approved pool drives the layout when there is no lock", () => {
    expect(
      resolveMicrositeBlockSource({
        ...base,
        hasSegmentPool: true,
        hasBrandDefault: true,
      }),
    ).toBe("segment-pool");
  });

  it("falls back to the brand-default fixed list when there is no pool", () => {
    expect(
      resolveMicrositeBlockSource({ ...base, hasBrandDefault: true }),
    ).toBe("brand-default");
  });

  it("falls back to neutral freeform when nothing applies (today's behavior)", () => {
    expect(resolveMicrositeBlockSource(base)).toBe("neutral-freeform");
  });
});

describe("segmentPoolAllowedSet", () => {
  it("always includes the structural essentials", () => {
    const set = segmentPoolAllowedSet([]);
    expect(set.has(canonicalizeBlockType("hero"))).toBe(true);
    expect(set.has(canonicalizeBlockType("bottom-cta"))).toBe(true);
    expect(set.has(canonicalizeBlockType("footer"))).toBe(true);
  });

  it("includes the approved pool types (canonicalized) and excludes others", () => {
    const set = segmentPoolAllowedSet([EXTRA]);
    expect(set.has(canonicalizeBlockType(EXTRA))).toBe(true);
    expect(set.has("definitely-not-a-block")).toBe(false);
  });

  it("does not duplicate a structural type passed in the pool", () => {
    const set = segmentPoolAllowedSet(["hero", "footer"]);
    // 3 structural essentials only, no growth from the overlapping pool.
    expect(set.size).toBe(3);
  });
});

describe("buildSegmentPoolBlockGuide", () => {
  it("advertises ONLY the structural essentials when the pool is empty", () => {
    const types = bulletTypes(buildSegmentPoolBlockGuide([]));
    expect(types).toEqual(
      expect.arrayContaining(["hero", "bottom-cta", "footer"]),
    );
    expect(types).not.toContain(canonicalizeBlockType(EXTRA));
  });

  it("appends approved pool blocks ON TOP of the structural essentials", () => {
    const base = bulletTypes(buildSegmentPoolBlockGuide([]));
    const expanded = bulletTypes(buildSegmentPoolBlockGuide([EXTRA]));
    expect(expanded).toContain(canonicalizeBlockType(EXTRA));
    for (const t of base) expect(expanded).toContain(t);
    expect(expanded.length).toBe(base.length + 1);
    expect(new Set(expanded).size).toBe(expanded.length); // no duplicates
  });

  it("does not duplicate a pool block that is already structural", () => {
    const base = bulletTypes(buildSegmentPoolBlockGuide([]));
    const expanded = bulletTypes(buildSegmentPoolBlockGuide(["hero", "footer"]));
    expect(expanded.length).toBe(base.length);
    expect(new Set(expanded).size).toBe(expanded.length);
  });
});
