/**
 * Unit tests for the recipe block VOCABULARY module (June 2026, recipe builder).
 * Verifies the friendly menu, the advertised allow-set, and skeleton validation
 * — including the KEY requirement that GENERAL recipes may use the FULL
 * advertised general vocabulary, not just the curated built-in recipe subset.
 */
import { describe, it, expect } from "vitest";
import {
  availableBlocksForPath,
  advertisedBlockTypesForPath,
  friendlyBlockLabel,
  validateSkeleton,
  MAX_SKELETON_SLOTS,
} from "./recipe-block-vocab";
import { FREEFORM_RECIPES, MICROSITE_RECIPES, recipeSkeletonBlockTypes } from "./page-recipes";

describe("friendlyBlockLabel", () => {
  it("title-cases hyphenated block types", () => {
    expect(friendlyBlockLabel("kinetic-type-hero")).toBe("Kinetic Type Hero");
    expect(friendlyBlockLabel("benefits-grid")).toBe("Benefits Grid");
  });
  it("upper-cases known acronyms", () => {
    expect(friendlyBlockLabel("bottom-cta")).toBe("Bottom CTA");
    expect(friendlyBlockLabel("roi-calculator")).toBe("ROI Calculator");
    expect(friendlyBlockLabel("faq")).toBe("FAQ");
  });
});

describe("availableBlocksForPath", () => {
  it("returns a non-empty, alphabetically-sorted, de-duplicated menu for each path", () => {
    for (const path of ["freeform", "dso", "dso-practices", "microsite"] as const) {
      const blocks = availableBlocksForPath(path);
      expect(blocks.length).toBeGreaterThan(0);
      const labels = blocks.map((b) => b.label);
      expect([...labels]).toEqual([...labels].sort((a, b) => a.localeCompare(b)));
      expect(new Set(blocks.map((b) => b.type)).size).toBe(blocks.length);
      for (const b of blocks) {
        expect(b.type).toMatch(/^[a-z0-9-]+$/);
        expect(b.label.length).toBeGreaterThan(0);
      }
    }
  });

  it("memoizes (returns the same array instance on repeat calls)", () => {
    expect(availableBlocksForPath("freeform")).toBe(availableBlocksForPath("freeform"));
  });
});

describe("GENERAL vocabulary is broader than the curated built-in recipes", () => {
  it("advertises every block the built-in freeform recipes use, plus more", () => {
    const advertised = advertisedBlockTypesForPath("freeform");
    const curated = new Set(FREEFORM_RECIPES.flatMap(recipeSkeletonBlockTypes));
    for (const t of curated) expect(advertised.has(t)).toBe(true);
    // The full advertised vocabulary is a STRICT superset of the curated subset.
    expect(advertised.size).toBeGreaterThan(curated.size);
  });
});

describe("MICROSITE vocabulary + recipes", () => {
  it("advertises every block the built-in microsite recipes use", () => {
    const advertised = advertisedBlockTypesForPath("microsite");
    expect(advertised.size).toBeGreaterThan(0);
    for (const recipe of MICROSITE_RECIPES) {
      for (const type of recipeSkeletonBlockTypes(recipe)) {
        expect(
          advertised.has(type),
          `microsite recipe "${recipe.id}" names unadvertised block "${type}"`,
        ).toBe(true);
      }
    }
  });

  it("accepts a built-in microsite recipe skeleton through validateSkeleton", () => {
    const res = validateSkeleton("microsite", MICROSITE_RECIPES[0].skeleton);
    expect(res.ok).toBe(true);
  });

  it("advertises the five premium DSO blocks for the microsite path", () => {
    const advertised = advertisedBlockTypesForPath("microsite");
    for (const type of [
      "dso-paradigm-shift",
      "dso-stat-row",
      "dso-final-cta",
      "dso-software-showcase",
      "dso-ai-feature",
    ]) {
      expect(advertised.has(type), `microsite vocab is missing "${type}"`).toBe(true);
    }
  });

  it("accepts a microsite recipe skeleton built from the five premium DSO blocks", () => {
    const res = validateSkeleton("microsite", [
      "hero",
      "dso-paradigm-shift",
      "dso-stat-row",
      "dso-software-showcase",
      "dso-ai-feature",
      "dso-final-cta",
    ]);
    expect(res.ok).toBe(true);
  });
});

describe("validateSkeleton", () => {
  const path = "freeform" as const;
  const vocab = [...advertisedBlockTypesForPath(path)];

  it("accepts a valid skeleton and trims / normalizes whitespace", () => {
    const a = vocab[0];
    const b = vocab[1];
    const res = validateSkeleton(path, [`  ${a}  `, `  ${a}   OR   ${b}  `]);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.skeleton).toEqual([a, `${a} OR ${b}`]);
  });

  it("drops blank slots but keeps real ones", () => {
    const res = validateSkeleton(path, ["", "   ", vocab[0]]);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.skeleton).toEqual([vocab[0]]);
  });

  it("rejects a block type the path's AI cannot build", () => {
    const res = validateSkeleton(path, [vocab[0], "totally-not-a-real-block"]);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/aren't available/i);
  });

  it("rejects an unknown alternative inside an OR slot", () => {
    const res = validateSkeleton(path, [`${vocab[0]} OR totally-not-a-real-block`]);
    expect(res.ok).toBe(false);
  });

  it("rejects an empty section list", () => {
    expect(validateSkeleton(path, []).ok).toBe(false);
    expect(validateSkeleton(path, ["", "  "]).ok).toBe(false);
  });

  it("rejects a non-array and non-string entries", () => {
    expect(validateSkeleton(path, "hero" as unknown).ok).toBe(false);
    expect(validateSkeleton(path, [123] as unknown).ok).toBe(false);
  });

  it("rejects too many slots", () => {
    const many = Array.from({ length: MAX_SKELETON_SLOTS + 1 }, () => vocab[0]);
    const res = validateSkeleton(path, many);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/too many/i);
  });
});
