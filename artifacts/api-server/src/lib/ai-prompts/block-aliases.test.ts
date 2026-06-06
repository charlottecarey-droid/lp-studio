/**
 * Block-type alias guard (Task #1066 fix) — regression pins (Task #1067).
 *
 * The AI sometimes emits a "natural" block type name (`features`, `stats`,
 * `testimonials`, `cta`) that has NO `case` in lp-studio's BlockRenderer, which
 * would surface an "Unknown block type" placeholder on the published page.
 * `canonicalizeBlockType` maps each synonym to a real, renderable equivalent.
 *
 * These tests pin two invariants so a future change can't silently reintroduce
 * a broken section:
 *   1. Every documented synonym maps to its canonical type, and unknown types
 *      pass through unchanged.
 *   2. Every canonical target in BLOCK_TYPE_ALIASES is a type the renderer
 *      actually accepts — guards against a future renderer rename quietly
 *      breaking the mapping (the alias would start pointing at a dead type).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BLOCK_TYPE_ALIASES, canonicalizeBlockType } from "./block-aliases";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Source of truth for renderable block types: the `case "<type>":` labels in
 * lp-studio's BlockRenderer. Parsing the file (rather than hardcoding a list)
 * means the test tracks the renderer as it evolves — if a canonical target is
 * renamed or removed there, this set no longer contains it and test #2 fails.
 */
function loadRenderableTypes(): Set<string> {
  const rendererPath = resolve(
    __dirname,
    "../../../../lp-studio/src/blocks/BlockRenderer.tsx",
  );
  const src = readFileSync(rendererPath, "utf8");
  const types = new Set<string>();
  for (const m of src.matchAll(/case\s+"([^"]+)"\s*:/g)) {
    types.add(m[1]);
  }
  return types;
}

describe("canonicalizeBlockType", () => {
  it("maps every documented synonym to its canonical renderable type", () => {
    expect(canonicalizeBlockType("features")).toBe("benefits-grid");
    expect(canonicalizeBlockType("stats")).toBe("trust-bar");
    expect(canonicalizeBlockType("testimonials")).toBe("testimonial");
    expect(canonicalizeBlockType("cta")).toBe("bottom-cta");
  });

  it("maps every key in BLOCK_TYPE_ALIASES to its declared value", () => {
    for (const [synonym, canonical] of Object.entries(BLOCK_TYPE_ALIASES)) {
      expect(canonicalizeBlockType(synonym)).toBe(canonical);
    }
  });

  it("passes unknown / non-alias types through unchanged", () => {
    for (const type of ["hero", "benefits-grid", "dso-heartland-hero", "totally-made-up"]) {
      expect(canonicalizeBlockType(type)).toBe(type);
    }
  });
});

describe("BLOCK_TYPE_ALIASES integrity", () => {
  it("every alias target is a block type the renderer accepts", () => {
    const renderable = loadRenderableTypes();
    // Sanity: the parser actually found renderer cases (guards a moved file /
    // changed `case` formatting silently making this assertion vacuous).
    expect(renderable.size).toBeGreaterThan(20);

    const broken = Object.entries(BLOCK_TYPE_ALIASES).filter(
      ([, canonical]) => !renderable.has(canonical),
    );
    expect(broken).toEqual([]);
  });
});
