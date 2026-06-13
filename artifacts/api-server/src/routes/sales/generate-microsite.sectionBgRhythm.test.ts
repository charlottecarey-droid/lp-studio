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
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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

// ───────────────────────────────────────────────────────────────────────────
// STRUCTURAL GUARD — auto-discover self-section blocks from the renderer source
// and require each one to be seeded by mergeWithDefaults.
//
// The per-block tests above pin the two KNOWN regressing blocks
// (`dandy-columns-v3`, `testimonial`). But the root cause is structural: ANY
// block whose component renders its own `<section>` with a hardcoded near-white
// background and only resolves a preset when `props.backgroundStyle` is present
// is invisible to the background-rhythm passes. If a new such block is added and
// `mergeWithDefaults` does not seed it a light-neutral `backgroundStyle`, the
// all-white regression silently returns — and the hand-written tests above
// won't notice because they only know about the two existing blocks.
//
// This guard enumerates self-section blocks DIRECTLY from the LP renderer source
// (so the list can never drift from reality) and asserts every one of them is
// seeded. When someone adds a new self-section block without a seed, the test
// fails loudly and names the missing block type.
// ───────────────────────────────────────────────────────────────────────────

const BLOCKS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../lp-studio/src/blocks",
);
const RENDERER_FILE = path.join(BLOCKS_DIR, "BlockRenderer.tsx");

// The established idiom a self-section block uses to keep its hardcoded
// near-white look while honoring an optional preset:
//   props.backgroundStyle ? getBgStyle(props.backgroundStyle) : { background: "#HEX" }
// When the else-branch hex is near-white, an unseeded block reads as all-white.
// The background value may be a plain hex ("#ffffff") OR a color-mix anchored on a
// near-white hex ("color-mix(in srgb, var(--brand-primary) 4%, #ffffff)"). Capture the
// first hex inside the background string so both forms are discovered.
const SELF_SECTION_FALLBACK =
  /props\.backgroundStyle\s*\?\s*getBgStyle\([^)]*\)\s*:\s*\{\s*background:\s*["'][^"']*?(#[0-9A-Fa-f]{6})[^"']*["']/g;

// Whole-channel near-white check: every RGB channel is light. A dark / brand
// fallback hex (which would NOT read as all-white) is intentionally excluded.
function isNearWhite(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return r >= 0xcc && g >= 0xcc && b >= 0xcc;
}

// Exported block component(s) defined in a file, e.g. `export function BlockX(`.
function exportedComponents(source: string): string[] {
  const out: string[] = [];
  const re = /export\s+function\s+(Block[A-Za-z0-9_]+)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) out.push(m[1]);
  return out;
}

// Map a renderer component name (e.g. `BlockTestimonial`) to the block `type`
// strings the BlockRenderer switch renders it for. Walks backwards from every
// `<Component` usage collecting the consecutive `case "x":` labels above it
// (skipping the intervening `return (` / `(` / blank lines), which handles
// fall-through multi-case blocks and components that are reused in the switch.
function typesForComponent(rendererLines: string[], component: string): string[] {
  const usage = new RegExp(`<${component}(?![A-Za-z0-9_])`);
  const caseRe = /^case\s+"([^"]+)"\s*:/;
  const skippable = /^(return\s*\(?|\(|\{|\}|)$/;
  const types = new Set<string>();
  rendererLines.forEach((line, i) => {
    if (!usage.test(line)) return;
    for (let j = i - 1; j >= 0; j--) {
      const t = rendererLines[j].trim();
      const caseMatch = caseRe.exec(t);
      if (caseMatch) {
        types.add(caseMatch[1]);
        continue;
      }
      if (skippable.test(t)) continue;
      break;
    }
  });
  return [...types];
}

describe("microsite section background — structural self-section guard", () => {
  // Discover every self-section near-white block from the renderer source and
  // resolve it to its block type(s). Shared across the assertions below.
  const renderer = fs.readFileSync(RENDERER_FILE, "utf8");
  const rendererLines = renderer.split("\n");

  const blockFiles = fs
    .readdirSync(BLOCKS_DIR)
    .filter(f => f.startsWith("Block") && f.endsWith(".tsx") && f !== "BlockRenderer.tsx");

  // { type, component, file, hex } for each self-section block type discovered.
  const discovered: { type: string; component: string; file: string; hex: string }[] = [];
  const unmappedComponents: { component: string; file: string }[] = [];

  for (const file of blockFiles) {
    const source = fs.readFileSync(path.join(BLOCKS_DIR, file), "utf8");
    SELF_SECTION_FALLBACK.lastIndex = 0;
    let match: RegExpExecArray | null;
    let nearWhiteHex: string | null = null;
    while ((match = SELF_SECTION_FALLBACK.exec(source))) {
      if (isNearWhite(match[1])) {
        nearWhiteHex = match[1];
        break;
      }
    }
    if (!nearWhiteHex) continue;

    const components = exportedComponents(source);
    for (const component of components) {
      const types = typesForComponent(rendererLines, component);
      if (types.length === 0) {
        unmappedComponents.push({ component, file });
        continue;
      }
      for (const type of types) {
        discovered.push({ type, component, file, hex: nearWhiteHex });
      }
    }
  }

  it("discovers the known self-section blocks (the scan actually works)", () => {
    // Sanity: if this set ever empties, the regex/path drifted and the guard
    // below would silently pass while protecting nothing.
    const types = new Set(discovered.map(d => d.type));
    expect(types.has("testimonial")).toBe(true);
    expect(types.has("dandy-columns-v3")).toBe(true);
  });

  it("maps every self-section component to a renderer block type", () => {
    // A self-section near-white block that the renderer switch doesn't route to
    // a `type` can't be verified for a seed. Fail loudly so a human wires it in
    // (or confirms it's a sub-component that needs its parent guarded instead).
    expect(
      unmappedComponents,
      `Self-section near-white block component(s) not found in the BlockRenderer ` +
        `switch — cannot verify their backgroundStyle seed:\n` +
        unmappedComponents.map(u => `  • ${u.component} (${u.file})`).join("\n"),
    ).toEqual([]);
  });

  it("seeds a light-neutral backgroundStyle for every self-section block type", () => {
    // THE guard: each discovered self-section type must come out of the real
    // generation defaults (normalizeBlock → mergeWithDefaults) carrying a
    // light-neutral backgroundStyle, the exact property whose absence makes the
    // section invisible to the rhythm passes and read as all-white.
    const offenders: string[] = [];
    for (const { type, component, file, hex } of discovered) {
      const [block] = normalize([{ type, props: {} }]);
      const bg = bgOf(block);
      if (typeof bg !== "string") {
        offenders.push(
          `${type} (${component} in ${file}, fallback ${hex}) — mergeWithDefaults ` +
            `seeds no backgroundStyle; add it to SECTION_BG_SEED_DEFAULTS or its case`,
        );
        continue;
      }
      if (!NEAR_WHITE.includes(bg)) {
        offenders.push(
          `${type} (${component}) — seeded "${bg}" but the seed MUST be light-neutral ` +
            `(${NEAR_WHITE.join("/")}); a dark/brand seed freezes the section`,
        );
      }
    }
    expect(
      offenders,
      `Self-section block(s) will silently render all-white because they aren't ` +
        `seeded a light-neutral backgroundStyle by mergeWithDefaults:\n` +
        offenders.map(o => `  • ${o}`).join("\n"),
    ).toEqual([]);
  });
});
