/**
 * Regression guard — generated microsite sections must NOT silently go all-white.
 *
 * The all-white regression happened because self-section blocks
 * (`dandy-columns-v3`, `testimonial`) render their own `<section>` with a
 * hardcoded near-white background and never carried a `backgroundStyle` prop.
 * The deterministic background-rhythm passes only touch blocks that ALREADY
 * carry `backgroundStyle` (`applyDesignIntensityBackgrounds` gates on
 * `"backgroundStyle" in props`; `applyDandySupportingVariability` only swaps
 * among light-neutral presets), so those blocks were silently skipped and every
 * section read as white.
 *
 * The fix is to SEED a light-neutral `backgroundStyle` for those self-section
 * blocks in `mergeWithDefaults` (the `testimonial` case sets it directly;
 * `dandy-columns-v3` flows through `SECTION_BG_SEED_DEFAULTS` in the `default:`
 * case). These tests run the real generation pipeline pure helpers in-process
 * (no port+fetch — see the sales-route test conventions) and pin the contract:
 *
 *   1. SEEDED — after `normalizeBlock`, `dandy-columns-v3` and `testimonial`
 *      both carry a `backgroundStyle` (the property that makes them visible to
 *      the rhythm passes). This is the exact prop whose absence caused the bug.
 *   2. VARIED RHYTHM — running the full pipeline on a representative block set
 *      yields sections that are NOT all the same near-white background, and the
 *      consecutive light self-section blocks get distinct backgrounds.
 *   3. REACHABLE BY THE DESIGN PASS — because the self-section blocks now carry
 *      `backgroundStyle`, the design-intensity pass can push at least one of
 *      them dark/brand; before the fix the pass skipped them and nothing went
 *      dark on an all-light page.
 *
 * If a NEW self-section block is added without a seed it will re-introduce this
 * bug; the representative-pipeline test below is the lock that catches it for
 * the two known blocks.
 */
import { describe, expect, it } from "vitest";
import { normalizeBlock, applyDandySupportingVariability } from "./generate-microsite";
import { applyDesignIntensityBackgrounds } from "../lp/generate-page";

type Block = Record<string, unknown>;

// The three interchangeable light-neutral presets the renderer treats as
// near-white. "All-white" == every section's backgroundStyle is one of these.
const NEAR_WHITE = ["white", "light-gray", "muted"];
// Backgrounds that read as a distinct dark / brand anchor (break up the rhythm).
const DARK_BRAND = ["dark", "black", "dandy-green", "gradient"];

const brand = { name: "Acme", tagline: "We make it easy", valuePropPairs: [] };

function normalize(raw: Block[]): Block[] {
  return raw.map((b, i) => normalizeBlock(b as never, i, brand as never)) as Block[];
}

function bgOf(block: Block): unknown {
  return (block.props as Block).backgroundStyle;
}

// A representative curated Dandy microsite: the lead hero, light supporting
// sections (including the two self-section blocks that regressed), a brand
// anchor and a dark CTA — the same mix the real generator produces.
function representativePage(): Block[] {
  return [
    { type: "dso-heartland-hero", props: { headline: "Built for scale" } },
    { type: "dso-stat-bar", props: { stats: [] } },
    { type: "dandy-columns-v3", props: { headline: "How it works" } },
    { type: "dso-challenges", props: { challenges: [] } },
    { type: "testimonial", props: { quote: "Loved it", author: "Dr. Lee" } },
    { type: "dso-success-stories", props: { backgroundStyle: "dandy-green", cases: [] } },
    { type: "bottom-cta", props: { headline: "Ready?" } },
  ];
}

describe("microsite section background — self-section blocks are seeded", () => {
  it("gives dandy-columns-v3 and testimonial a backgroundStyle after normalizeBlock", () => {
    const blocks = normalize([
      { type: "dandy-columns-v3", props: { headline: "How it works" } },
      { type: "testimonial", props: { quote: "Great", author: "Dr. Lee" } },
    ]);
    const columns = blocks.find(b => b.type === "dandy-columns-v3")!;
    const testimonial = blocks.find(b => b.type === "testimonial")!;
    // The exact property whose absence caused the all-white regression.
    expect(bgOf(columns)).toBeDefined();
    expect(bgOf(testimonial)).toBeDefined();
    // Seeds are light-neutral so the rhythm passes can vary them (seeding a
    // dark/brand preset would freeze the section — see memory note).
    expect(NEAR_WHITE).toContain(bgOf(columns));
    expect(NEAR_WHITE).toContain(bgOf(testimonial));
  });

  it("preserves an explicit backgroundStyle instead of overwriting it (legacy rows)", () => {
    const [columns] = normalize([
      { type: "dandy-columns-v3", props: { headline: "x", backgroundStyle: "dark" } },
    ]);
    expect(bgOf(columns)).toBe("dark");
  });
});

describe("microsite background rhythm — full pipeline is not all-white", () => {
  it("yields a varied rhythm with at least one dark/brand section", () => {
    // normalizeBlock -> applyDesignIntensityBackgrounds -> applyDandySupportingVariability
    const normalized = normalize(representativePage());
    const designed = applyDesignIntensityBackgrounds(normalized, "balanced") as Block[];
    const out = applyDandySupportingVariability(designed as never, "acct-1:Bright Smiles");

    const bgs = out.map(bgOf).filter(v => typeof v === "string") as string[];
    // The whole point: sections must NOT all share one near-white background.
    expect(bgs.every(v => NEAR_WHITE.includes(v))).toBe(false);
    // At least one section reads as a distinct dark / brand anchor.
    expect(bgs.some(v => DARK_BRAND.includes(v))).toBe(true);
    // …and there is genuine variety, not a single repeated value.
    expect(new Set(bgs).size).toBeGreaterThan(1);

    // The two self-section blocks still carry a backgroundStyle through the
    // whole pipeline (never dropped back to undefined / hardcoded near-white).
    expect(bgOf(out.find(b => b.type === "dandy-columns-v3")!)).toBeDefined();
    expect(bgOf(out.find(b => b.type === "testimonial")!)).toBeDefined();
  });

  it("varies consecutive light self-section blocks instead of repeating white", () => {
    // An all-light page of self-section blocks: before the seed fix these would
    // all be undefined -> hardcoded near-white -> identical. With the seed +
    // supporting-variability pass, consecutive light sections must differ.
    const normalized = normalize([
      { type: "dandy-columns-v3", props: { headline: "A" } },
      { type: "dso-stat-bar", props: { stats: [] } },
      { type: "testimonial", props: { quote: "B", author: "C" } },
    ]);
    let sawDistinctRhythm = false;
    for (let i = 0; i < 50; i++) {
      const out = applyDandySupportingVariability(normalized as never, `acct-${i}:Co ${i}`);
      const seq = out.map(bgOf);
      // Every section is defined and light-neutral…
      expect(seq.every(v => typeof v === "string" && NEAR_WHITE.includes(v as string))).toBe(true);
      // …and at least one account produces adjacent sections that differ.
      if (seq[0] !== seq[1] || seq[1] !== seq[2]) sawDistinctRhythm = true;
    }
    expect(sawDistinctRhythm).toBe(true);
  });

  it("pushes a self-section block dark under an editorial-dense intensity", () => {
    // Reachability proof: because the self-section blocks now carry a
    // backgroundStyle, applyDesignIntensityBackgrounds can promote them. Before
    // the seed fix the pass found no `backgroundStyle` and skipped them, so an
    // all-light page of these blocks stayed entirely near-white.
    const normalized = normalize([
      { type: "dandy-columns-v3", props: { headline: "A" } },
      { type: "testimonial", props: { quote: "B", author: "C" } },
    ]);
    const designed = applyDesignIntensityBackgrounds(normalized, "editorial-dense") as Block[];
    const bgs = designed.map(bgOf) as string[];
    expect(bgs.some(v => DARK_BRAND.includes(v))).toBe(true);
  });
});
