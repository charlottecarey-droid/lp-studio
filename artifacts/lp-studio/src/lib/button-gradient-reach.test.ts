/**
 * Gradient primary-button fills must reach the blocks that hand-roll their
 * buttons with an inline background (the DSO family, the final-CTA blocks,
 * the sticky site header — 34 blocks, all of them routed through
 * pickCtaButtonColors). A CSS rule can't reach those: they carry no marker
 * class, and their fill is an inline style. So the helper itself returns the
 * gradient.
 */
import { describe, it, expect } from "vitest";
import { DEFAULT_BRAND, pickCtaButtonColors, relativeLuminance, type BrandConfig } from "./brand-config";

/** WCAG contrast ratio between two hexes (brand-config keeps its own copy private). */
function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
import { gradientButtonStyleRaw } from "./button-gradient";

const GRADIENT = { from: "#4B47E5", to: "#8B5CF6", angle: 90 };
const gradientBrand = (textColor = "#ffffff"): BrandConfig => ({
  ...DEFAULT_BRAND,
  buttonStyleRaw: gradientButtonStyleRaw(GRADIENT, textColor),
});

describe("pickCtaButtonColors — gradient fills", () => {
  it("returns the gradient CSS as the fill so inline-styled buttons render it", () => {
    const { bg } = pickCtaButtonColors(gradientBrand(), "#ffffff");
    expect(bg).toBe("linear-gradient(90deg, #4b47e5 0%, #8b5cf6 100%)");
  });

  it("returns a label contrast-resolved against the gradient's first stop", () => {
    const { text } = pickCtaButtonColors(gradientBrand("#ffffff"), "#ffffff");
    expect(contrastRatio(text, "#4b47e5")).toBeGreaterThanOrEqual(4.5);
  });

  it("replaces an illegible authored label rather than rendering it", () => {
    // Near-identical to the first stop — must not survive.
    const { text } = pickCtaButtonColors(gradientBrand("#4B47E6"), "#ffffff");
    expect(text.toLowerCase()).not.toBe("#4b47e6");
    expect(contrastRatio(text, "#4b47e5")).toBeGreaterThanOrEqual(4.5);
  });

  it("is independent of the section background — a gradient is the brand's fill", () => {
    const onLight = pickCtaButtonColors(gradientBrand(), "#ffffff").bg;
    const onDark = pickCtaButtonColors(gradientBrand(), "#0b0b12").bg;
    expect(onLight).toBe(onDark);
  });

  it("falls back to the solid path when no gradient is configured", () => {
    const solid = pickCtaButtonColors({ ...DEFAULT_BRAND, ctaBackground: "#0F6E56" }, "#ffffff");
    expect(solid.bg).toBe("#0F6E56");
    expect(solid.bg).not.toContain("gradient");
  });

  it("ignores a solid buttonStyleRaw background (only gradients take this path)", () => {
    const raw = gradientButtonStyleRaw(GRADIENT, "#ffffff");
    const brand: BrandConfig = {
      ...DEFAULT_BRAND,
      ctaBackground: "#0F6E56",
      buttonStyleRaw: { ...raw, background: { type: "solid", value: "#ff0066" } },
    };
    expect(pickCtaButtonColors(brand, "#ffffff").bg).toBe("#0F6E56");
  });
});
