import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it, vi } from "vitest";

/**
 * Regression for the "black headline on dark brand teal" bug.
 *
 * When `backgroundColor` is unset, the product hero paints its section with the
 * default `var(--brand-primary)`. The headline ink is derived from that same
 * surface — but the contrast resolver can only measure a hex, so an unparsed
 * "var(--brand-…)" string was treated as white and the headline was painted
 * near-black, i.e. dark text on the dark brand background.
 *
 * The block now resolves the brand CSS variable to the LIVE tenant brand hex
 * (via `useBrandConfig`) before the contrast math. This test stubs the brand to
 * a dark primary and asserts the headline ink stays readable against it. The
 * `BlockDandyProductHero.contrast.test.ts` companion covers the CTA fill with an
 * explicit (hex) `backgroundColor`; this covers the brand-var default surface.
 */

const { TEST_BRAND } = vi.hoisted(() => ({
  // A dark brand primary (Dandy-style teal) with no explicit textColor — the
  // worst case for the old white-surface fallback.
  TEST_BRAND: { primaryColor: "#0b3d36", accentColor: "#c7e738" },
}));

vi.mock("@/components/BrandSwatches", () => ({
  useBrandConfig: () => TEST_BRAND as unknown as import("@/lib/brand-config").BrandConfig,
}));
vi.mock("@/components/EmailCaptureModal", () => ({ EmailCaptureModal: () => null }));

import { BlockDandyProductHero } from "./BlockDandyProductHero";
import { relativeLuminance } from "@/lib/brand-config";
import type { DandyProductHeroBlockProps } from "@/lib/block-types/dso-blocks";

/** WCAG contrast ratio between two hex colors (1–21). */
function contrast(hexA: string, hexB: string): number {
  const a = relativeLuminance(hexA);
  const b = relativeLuminance(hexB);
  const [lo, hi] = a < b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/** Pull the inline `color:` off the first `<h1 style="…">` in the markup. */
function headlineColor(markup: string): string | undefined {
  const m = /<h1\b[^>]*?\sstyle="([^"]*)"/.exec(markup);
  if (!m) return undefined;
  for (const decl of m[1].split(";")) {
    const i = decl.indexOf(":");
    if (i === -1) continue;
    if (decl.slice(0, i).trim() === "color") return decl.slice(i + 1).trim();
  }
  return undefined;
}

describe("BlockDandyProductHero headline ink on the brand-var default surface", () => {
  it("derives a light, readable headline ink against the dark brand-primary bg", () => {
    // No `backgroundColor` → bg falls back to `var(--brand-primary)`, which
    // resolves to the dark TEST_BRAND primary.
    const props = {
      headline: "Crowns, redefined",
      variant: "split",
    } as DandyProductHeroBlockProps;
    const markup = renderToStaticMarkup(
      createElement(BlockDandyProductHero, { block: { props } }),
    );
    const color = headlineColor(markup);
    expect(color).toBeDefined();
    expect(contrast(color as string, TEST_BRAND.primaryColor)).toBeGreaterThanOrEqual(4.5);
  });
});
