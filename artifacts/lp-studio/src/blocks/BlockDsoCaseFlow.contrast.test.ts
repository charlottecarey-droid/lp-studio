import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it } from "vitest";

import { BlockDsoCaseFlow } from "./BlockDsoCaseFlow";
import {
  DEFAULT_BRAND,
  isValidHex,
  relativeLuminance,
  type BrandConfig,
} from "@/lib/brand-config";
import type { DsoCaseFlowBlockProps } from "@/lib/block-types";
import type { BackgroundStyle } from "@/lib/bg-styles";

/**
 * Recompute WCAG contrast from the exported `relativeLuminance`, mirroring the
 * approach used by the sibling `*.contrast.test.ts` files.
 */
function contrast(hexA: string, hexB: string): number {
  const a = relativeLuminance(hexA);
  const b = relativeLuminance(hexB);
  const [lo, hi] = a < b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/** WCAG AA for normal text. */
const TEXT_MIN = 4.5;

/**
 * Pull every inline `color: <value>` declaration out of the rendered markup.
 * React serializes style objects as kebab-case `prop:value;` pairs, so this
 * captures the `color` of headings, body copy, eyebrow, metrics, stage labels
 * and the icon wrapper — every text/icon surface the block paints.
 */
function extractColors(markup: string): string[] {
  const out: string[] = [];
  for (const match of markup.matchAll(/style="([^"]*)"/g)) {
    for (const decl of match[1].split(";").filter(Boolean)) {
      const idx = decl.indexOf(":");
      if (idx === -1) continue;
      const prop = decl.slice(0, idx).trim();
      const value = decl.slice(idx + 1).trim();
      if (prop === "color") out.push(value);
    }
  }
  return out;
}

function baseProps(backgroundStyle: BackgroundStyle): DsoCaseFlowBlockProps {
  return {
    eyebrow: "How it works",
    headline: "From request to delivery, in days.",
    subheadline: "Every workflow follows the same precise, validated path.",
    backgroundStyle,
  } as DsoCaseFlowBlockProps;
}

function render(brand: BrandConfig, backgroundStyle: BackgroundStyle): string {
  // No `onFieldChange` → builder-only popovers/pickers are not rendered.
  return renderToStaticMarkup(
    createElement(BlockDsoCaseFlow, { props: baseProps(backgroundStyle), brand }),
  );
}

/** Resolved solid background hex per light preset (matches the block's own map). */
const LIGHT_BG_HEX: Record<string, string> = {
  white: "#ffffff",
  "light-gray": "#f8fafc",
  muted: "#f6f4ef",
};

// A Dandy-style palette (forest primary + lime accent) — the exact brand whose
// live enterprise microsite surfaced the white-on-off-white bug — plus the
// neutral DEFAULT_BRAND (slate primary + blue accent).
const DANDY_BRAND: BrandConfig = {
  ...DEFAULT_BRAND,
  primaryColor: "#003A30",
  accentColor: "#c7e738",
};

describe("BlockDsoCaseFlow contrast", () => {
  for (const [style, bgHex] of Object.entries(LIGHT_BG_HEX)) {
    for (const [brandName, brand] of [
      ["DEFAULT_BRAND", DEFAULT_BRAND],
      ["Dandy", DANDY_BRAND],
    ] as const) {
      it(`keeps every text color legible on the "${style}" light background (${brandName})`, () => {
        const markup = render(brand, style as BackgroundStyle);
        const colors = extractColors(markup);

        // The block paints many text surfaces; ensure we actually parsed some.
        expect(colors.length).toBeGreaterThan(0);

        for (const color of colors) {
          // On a light surface no color should be a CSS var (the dark-treatment
          // fallbacks) — every text color must be a concrete, legible hex.
          expect(isValidHex(color)).toBe(true);
          expect(contrast(color, bgHex)).toBeGreaterThanOrEqual(TEXT_MIN);
        }
      });
    }
  }

  it("never renders a near-white text color on the default muted background (the reported bug)", () => {
    const markup = render(DANDY_BRAND, "muted");
    for (const color of extractColors(markup)) {
      // White-ish text on off-white is exactly what made the live page illegible.
      expect(contrast(color, "#f6f4ef")).toBeGreaterThanOrEqual(TEXT_MIN);
    }
  });

  for (const style of ["dark", "black", "dandy-green", "gradient"] as const) {
    it(`preserves the premium light-on-dark treatment on the "${style}" background`, () => {
      const markup = render(DANDY_BRAND, style);
      // The dark treatment is unchanged: light heading + brand accent CSS vars.
      expect(markup).toContain("var(--brand-heading-on-dark");
      expect(markup).toContain("var(--brand-accent");
    });
  }
});
