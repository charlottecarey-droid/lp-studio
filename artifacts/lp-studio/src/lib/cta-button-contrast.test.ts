import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_BRAND,
  pickCtaButtonColors,
  relativeLuminance,
  type BrandConfig,
} from "./brand-config";

/**
 * Recompute WCAG contrast from the exported `relativeLuminance` so the test
 * is independent of the (unexported) internal `contrastRatio` helper.
 */
function contrast(hexA: string, hexB: string): number {
  const a = relativeLuminance(hexA);
  const b = relativeLuminance(hexB);
  const [lo, hi] = a < b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/** WCAG AA for non-text UI components (button fill vs. its section). */
const UI_MIN = 3.0;
/** WCAG AA for normal text (button label vs. its fill). */
const TEXT_MIN = 4.5;

/**
 * A matrix of brand palettes spanning the realistic range: a default-ish
 * neutral brand, a saturated single-hue brand (the classic "blue button on
 * blue section" trap), a near-black brand, a near-white/pastel brand, and a
 * brand whose explicit cta tokens clash with the section.
 */
const BRANDS: Record<string, BrandConfig> = {
  neutral: {
    ...DEFAULT_BRAND,
    primaryColor: "#0f172a",
    accentColor: "#3b82f6",
    ctaBackground: "#0f172a",
    ctaText: "#ffffff",
  },
  saturatedBlue: {
    ...DEFAULT_BRAND,
    primaryColor: "#1d4ed8",
    accentColor: "#2563eb",
    ctaBackground: "#2563eb",
    ctaText: "#ffffff",
  },
  forestLime: {
    ...DEFAULT_BRAND,
    primaryColor: "#14532d",
    accentColor: "#84cc16",
    ctaBackground: "#84cc16",
    ctaText: "#14532d",
  },
  nearBlack: {
    ...DEFAULT_BRAND,
    primaryColor: "#000000",
    accentColor: "#111111",
    ctaBackground: "#000000",
    ctaText: "#ffffff",
  },
  pastel: {
    ...DEFAULT_BRAND,
    primaryColor: "#fde68a",
    accentColor: "#fef3c7",
    ctaBackground: "#fef3c7",
    ctaText: "#fffbeb",
  },
  clashingTokens: {
    // Explicit cta tokens that would be invisible on a matching section.
    ...DEFAULT_BRAND,
    primaryColor: "#7c3aed",
    accentColor: "#a855f7",
    ctaBackground: "#a855f7",
    ctaText: "#a855f7",
  },
};

/**
 * Section backgrounds a block's `bgColor` can resolve to: page white, brand
 * primary, brand accent, dark surfaces, mid grays (the worst-case for
 * black/white fallback), and `null`/invalid (defaults to white).
 */
const SECTION_BGS: (string | null | undefined)[] = [
  "#ffffff",
  "#000000",
  "#0a0a0a",
  "#f8fafc",
  "#1d4ed8",
  "#2563eb",
  "#84cc16",
  "#a855f7",
  "#767676", // classic worst-case gray (~4.5 against both black and white)
  "#949494",
  "#5b5b5b",
  null,
  undefined,
  "not-a-hex",
];

describe("pickCtaButtonColors", () => {
  for (const [brandName, brand] of Object.entries(BRANDS)) {
    for (const sectionBg of SECTION_BGS) {
      it(`keeps the button readable for ${brandName} on section ${String(
        sectionBg,
      )}`, () => {
        const { bg, text } = pickCtaButtonColors(brand, sectionBg);

        // Resolved colors must be valid hex.
        expect(bg).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(text).toMatch(/^#[0-9a-fA-F]{6}$/);

        const resolvedSection =
          sectionBg && /^#[0-9a-fA-F]{6}$/.test(sectionBg)
            ? sectionBg
            : "#ffffff";

        // Button fill is distinguishable from the section it sits on.
        expect(contrast(bg, resolvedSection)).toBeGreaterThanOrEqual(UI_MIN);
        // Button label is legible on the button fill.
        expect(contrast(text, bg)).toBeGreaterThanOrEqual(TEXT_MIN);
      });
    }
  }

  it("stays readable in the degenerate case where section == accent == primary", () => {
    const sameColor = "#2563eb";
    const brand: BrandConfig = {
      ...DEFAULT_BRAND,
      primaryColor: sameColor,
      accentColor: sameColor,
      ctaBackground: sameColor,
      ctaText: sameColor,
    };

    const { bg, text } = pickCtaButtonColors(brand, sameColor);

    // The fill must NOT collapse onto the identical section color.
    expect(contrast(bg, sameColor)).toBeGreaterThanOrEqual(UI_MIN);
    expect(contrast(text, bg)).toBeGreaterThanOrEqual(TEXT_MIN);
  });
});

/**
 * Static regression guard: a CTA button fill must be resolved at runtime via
 * `pickCtaButtonColors`, never hardcoded to the brand accent on a section
 * background. The Tailwind pattern below paints the button accent-on-section
 * unconditionally, which goes invisible when the section bg is the accent.
 *
 * The files below are the only ALLOWED occurrences: each pairs the hardcoded
 * class with a runtime `pickCtaButtonColors(...)` result and only falls back
 * to the class when contrast resolution is unavailable (or is a decorative,
 * non-CTA badge). Any NEW file containing this pattern fails the test so a
 * regression is caught at review time.
 */
describe("hardcoded accent-fill button pattern", () => {
  const HARDCODED =
    "bg-[var(--brand-accent)] text-[var(--brand-cta-text)]";

  const ALLOWLIST = new Set([
    // Fallback only when `ctaColors` is null (invalid section bg).
    "BlockDandyHeroV7S3.tsx",
    "BlockDandySiteHeader.tsx",
  ]);

  it("is not reintroduced in any block outside the allowlist", () => {
    const blocksDir = join(dirname(fileURLToPath(import.meta.url)), "..", "blocks");
    const offenders: string[] = [];

    for (const file of readdirSync(blocksDir)) {
      if (!file.endsWith(".tsx")) continue;
      const source = readFileSync(join(blocksDir, file), "utf8");
      if (source.includes(HARDCODED) && !ALLOWLIST.has(file)) {
        offenders.push(file);
      }
    }

    expect(
      offenders,
      `These blocks hardcode the accent-fill button pattern instead of using ` +
        `pickCtaButtonColors(brand, sectionBg). Resolve button colors at ` +
        `runtime so they stay visible on any brand/section color:\n` +
        offenders.join("\n"),
    ).toEqual([]);
  });

  it("still covers every currently-allowlisted file (keeps the list honest)", () => {
    const blocksDir = join(dirname(fileURLToPath(import.meta.url)), "..", "blocks");
    const stillPresent = new Set<string>();

    for (const file of readdirSync(blocksDir)) {
      if (!file.endsWith(".tsx")) continue;
      const source = readFileSync(join(blocksDir, file), "utf8");
      if (source.includes(HARDCODED)) stillPresent.add(file);
    }

    // Every allowlisted file must still contain the pattern; otherwise the
    // entry is stale and should be removed from ALLOWLIST.
    for (const allowed of ALLOWLIST) {
      expect(
        stillPresent.has(allowed),
        `ALLOWLIST entry ${allowed} no longer contains the hardcoded ` +
          `pattern — remove it from the allowlist.`,
      ).toBe(true);
    }
  });
});
