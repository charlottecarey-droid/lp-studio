import { describe, it, expect } from "vitest";
import {
  resolveMicrositeBlockSource,
  segmentPoolAllowedSet,
  buildSegmentPoolBlockGuide,
  segmentPoolFallbackBlockList,
} from "./generate-microsite";
import { enforceRequiredRoles } from "../lp/generate-page";
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
    hasSegmentOutline: false,
    hasSegmentPool: false,
    hasBrandOutline: false,
  } as const;

  it("template wins over everything", () => {
    expect(
      resolveMicrositeBlockSource({
        ...base,
        hasTemplate: true,
        dsoFreeformMode: "enterprise",
        hasSegmentOutline: true,
        hasSegmentPool: true,
        hasBrandOutline: true,
      }),
    ).toBe("template");
  });

  it("a configured segment outline overrides dso-freeform, the pool, and the brand outline", () => {
    expect(
      resolveMicrositeBlockSource({
        ...base,
        dsoFreeformMode: "practices",
        hasSegmentOutline: true,
        hasSegmentPool: true,
        hasBrandOutline: true,
      }),
    ).toBe("segment-outline");
  });

  it("a configured brand outline overrides dso-freeform and the pool when there is no segment outline", () => {
    expect(
      resolveMicrositeBlockSource({
        ...base,
        dsoFreeformMode: "practices",
        hasSegmentPool: true,
        hasBrandOutline: true,
      }),
    ).toBe("brand-outline");
  });

  it("dso-freeform drives the page when no outline is configured (even with a pool)", () => {
    expect(
      resolveMicrositeBlockSource({
        ...base,
        dsoFreeformMode: "enterprise",
        hasSegmentPool: true,
      }),
    ).toBe("dso-freeform");
  });

  it("the approved pool drives the layout when there is no outline and no DSO vocab", () => {
    expect(
      resolveMicrositeBlockSource({ ...base, hasSegmentPool: true }),
    ).toBe("segment-pool");
  });

  it("falls back to the brand outline when there is no pool", () => {
    expect(
      resolveMicrositeBlockSource({ ...base, hasBrandOutline: true }),
    ).toBe("brand-outline");
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
    // 4 structural essentials only (hero, full-bleed-hero, bottom-cta,
    // footer), no growth from the overlapping pool.
    expect(set.size).toBe(4);
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

// Full pool pipeline: the post-parse clamp (segmentPoolAllowedSet) and the
// required-role backfill (enforceRequiredRoles) must AGREE — the backfill must
// never reintroduce an off-pool block after the clamp dropped them.
describe("enforceRequiredRoles — pool-aware backfill (task #5)", () => {
  it("backfills structural essentials but NOT off-pool body blocks in pool mode", () => {
    // An empty-pool segment: only the structural essentials are allowed. The
    // page starts with just a hero, so cta + footer are missing (and allowed),
    // while features/social-proof/stats are missing but NOT allowed.
    const allowed = segmentPoolAllowedSet([]);
    const blocks: Array<Record<string, unknown>> = [{ type: "hero", props: {} }];
    enforceRequiredRoles(blocks, { brandName: "Acme", allowedTypes: allowed });
    const types = blocks.map((b) => String(b.type));
    expect(types).toContain("bottom-cta");
    expect(types).toContain("footer");
    // Off-pool defaults must NOT be injected.
    expect(types).not.toContain("benefits-grid");
    expect(types).not.toContain("testimonial");
    expect(types).not.toContain("trust-bar");
  });

  it("backfills an approved body block when it IS in the pool", () => {
    const allowed = segmentPoolAllowedSet(["benefits-grid"]);
    const blocks: Array<Record<string, unknown>> = [{ type: "hero", props: {} }];
    enforceRequiredRoles(blocks, { brandName: "Acme", allowedTypes: allowed });
    const types = blocks.map((b) => String(b.type));
    expect(types).toContain("benefits-grid");
    // Still excludes the body blocks that were NOT approved.
    expect(types).not.toContain("testimonial");
    expect(types).not.toContain("trust-bar");
  });

  it("with no allow-set, keeps the legacy behavior (backfills every role)", () => {
    const blocks: Array<Record<string, unknown>> = [{ type: "hero", props: {} }];
    enforceRequiredRoles(blocks, { brandName: "Acme" });
    const types = blocks.map((b) => String(b.type));
    expect(types).toContain("benefits-grid");
    expect(types).toContain("testimonial");
    expect(types).toContain("trust-bar");
    expect(types).toContain("bottom-cta");
    expect(types).toContain("footer");
  });
});

// Degenerate fallback: when the model emits ZERO usable pool blocks, the
// last-resort layout must stay strictly pool-contained (never the generic
// NEUTRAL list, which would leak off-pool blocks).
describe("segmentPoolFallbackBlockList (task #5)", () => {
  // 66f04e520 switched the fallback's opening hero from the neutral "hero" to
  // "full-bleed-hero" (matching NEUTRAL_MICROSITE_BLOCK_LIST) — the expectations
  // below are re-pinned to that opener.
  it("frames the approved pool body with structural essentials", () => {
    const list = segmentPoolFallbackBlockList(["pricing-table", "faq-accordion"]);
    expect(list[0]).toBe(canonicalizeBlockType("full-bleed-hero"));
    expect(list[list.length - 2]).toBe(canonicalizeBlockType("bottom-cta"));
    expect(list[list.length - 1]).toBe(canonicalizeBlockType("footer"));
    expect(list).toContain(canonicalizeBlockType("pricing-table"));
    expect(list).toContain(canonicalizeBlockType("faq-accordion"));
  });

  // segmentPoolFallbackBlockList's opener to "full-bleed-hero" but left
  // SEGMENT_POOL_STRUCTURAL_TYPES (which feeds segmentPoolAllowedSet) at "hero",
  // so the fallback list now emits a block outside its own allow-set — the
  // route's pool validation can drop the fallback page's hero. Fix belongs in
  // generate-microsite.ts (align SEGMENT_POOL_STRUCTURAL_TYPES / the allow-set
  // with the "full-bleed-hero" opener), which is owned by another workstream.
  it("stays within the pool allow-set and never leaks off-pool blocks", () => {
    const pool = ["pricing-table", "faq-accordion"];
    const allowed = segmentPoolAllowedSet(pool);
    const list = segmentPoolFallbackBlockList(pool);
    for (const t of list) expect(allowed.has(t)).toBe(true);
    // Generic NEUTRAL-list body blocks must NOT appear unless approved.
    expect(list).not.toContain("trust-bar");
    expect(list).not.toContain("benefits-grid");
    expect(list).not.toContain("testimonial");
  });

  it("with an empty pool, returns just the structural essentials (no dupes)", () => {
    const list = segmentPoolFallbackBlockList([]);
    expect(list).toEqual([
      canonicalizeBlockType("full-bleed-hero"),
      canonicalizeBlockType("bottom-cta"),
      canonicalizeBlockType("footer"),
    ]);
  });

  it("dedupes and drops pool entries that collide with structural essentials", () => {
    const list = segmentPoolFallbackBlockList(["hero", "pricing-table", "pricing-table", "footer"]);
    // Exactly ONE opening hero: the pool's "hero" collides with the structural
    // hero slot and is dropped; the opener is the structural "full-bleed-hero".
    const heroFamily = new Set([canonicalizeBlockType("hero"), canonicalizeBlockType("full-bleed-hero")]);
    expect(list.filter((t) => heroFamily.has(t)).length).toBe(1);
    expect(list.filter((t) => t === canonicalizeBlockType("footer")).length).toBe(1);
    expect(list.filter((t) => t === canonicalizeBlockType("pricing-table")).length).toBe(1);
  });
});
