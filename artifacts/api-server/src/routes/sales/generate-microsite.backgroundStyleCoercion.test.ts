/**
 * Regression guard — a generated microsite must never render washed-out.
 *
 * The "washed-out microsite" bug: the model hallucinates non-preset tokens into
 * a block's `backgroundStyle` field — image-scene words like "starter",
 * "flagship", "laptop", "doctor". The LP renderer's getBgStyle() only knows the
 * seven canonical presets and SILENTLY falls back to plain white for anything
 * else, so every affected section reads as washed-out white.
 *
 * `mergeWithDefaults` used `backgroundStyle: p.backgroundStyle ?? <default>`, but
 * a non-null junk string is NOT nullish, so the junk survived the `??` and
 * reached the renderer; the section-bg rhythm pass skips `dso-*` blocks, so
 * nothing downstream corrected them. The fix coerces any non-preset value to
 * `undefined` so the per-block `?? <default>` fires.
 *
 * These tests run the real generation defaults in-process (normalizeBlock ->
 * mergeWithDefaults) and pin the contract: a hallucinated/blank backgroundStyle
 * must come out as one of the renderer's valid presets — never the junk token,
 * never white-by-accident.
 */
import { describe, expect, it } from "vitest";
import { normalizeBlock } from "./generate-microsite";

type Block = Record<string, unknown>;

// The complete set of presets the LP renderer (getBgStyle / resolveSectionSurface)
// actually knows. ANY other value resolves to plain white in the fallback.
const VALID_PRESETS = ["white", "light-gray", "muted", "dark", "dandy-green", "black", "gradient"];

const brand = { name: "Acme", tagline: "We make it easy", valuePropPairs: [] };

function normalizeOne(type: string, props: Block): Block {
  return normalizeBlock({ type, props } as never, 0, brand as never) as Block;
}

function bgOf(block: Block): unknown {
  return (block.props as Block).backgroundStyle;
}

// The exact hallucinated token -> dso block type pairs observed on the live
// washed-out microsite (slug dandy-42-north-dental-hq). Each of these dso blocks
// carries a `backgroundStyle` and must coerce its junk token to a real preset.
const HALLUCINATED: Array<{ type: string; junk: string }> = [
  { type: "dso-practice-hero", junk: "starter" },
  { type: "dso-stat-row", junk: "industry" },
  { type: "dso-partnership-perks", junk: "laptop" },
  { type: "dso-split-feature", junk: "generic" },
  { type: "dso-software-showcase", junk: "flagship" },
  { type: "dso-faq", junk: "workspace" },
  { type: "dso-activation-steps", junk: "distinctive" },
  { type: "dso-final-cta", junk: "doctor" },
];

describe("microsite background — hallucinated backgroundStyle is coerced to a real preset", () => {
  for (const { type, junk } of HALLUCINATED) {
    it(`coerces ${type} backgroundStyle "${junk}" to a valid preset`, () => {
      const block = normalizeOne(type, { backgroundStyle: junk });
      const bg = bgOf(block);
      // The junk token must never survive (it would render plain white).
      expect(bg).not.toBe(junk);
      // It must resolve to a real renderer preset (the block's intended default).
      expect(VALID_PRESETS).toContain(bg);
    });
  }

  it("coerces an empty-string backgroundStyle to a valid preset", () => {
    const block = normalizeOne("dso-practice-hero", { backgroundStyle: "" });
    const bg = bgOf(block);
    expect(bg).not.toBe("");
    expect(VALID_PRESETS).toContain(bg);
  });

  it("preserves a legitimate explicit backgroundStyle (legacy rows unaffected)", () => {
    // A dark dso block kept dark; a light-neutral kept light-neutral.
    expect(bgOf(normalizeOne("dso-practice-hero", { backgroundStyle: "dandy-green" }))).toBe("dandy-green");
    expect(bgOf(normalizeOne("dso-split-feature", { backgroundStyle: "light-gray" }))).toBe("light-gray");
  });

  it("seeds a self-section block (dandy-columns-v3) to a light-neutral even when fed junk", () => {
    // The default/fall-through path must coerce junk too: a seeded self-section
    // block gets its light-neutral seed instead of keeping the junk -> white.
    const block = normalizeOne("dandy-columns-v3", { backgroundStyle: "laptop", headline: "How it works" });
    const bg = bgOf(block);
    expect(["white", "light-gray", "muted"]).toContain(bg);
  });
});
