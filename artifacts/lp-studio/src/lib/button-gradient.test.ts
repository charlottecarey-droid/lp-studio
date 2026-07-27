import { describe, it, expect } from "vitest";
import {
  cssToGradient,
  gradientButtonStyleRaw,
  gradientFromOverrides,
  gradientToCss,
  isValidGradient,
} from "./button-gradient";
import { getBrandButtonCss, DEFAULT_BRAND } from "./brand-config";

const G = { from: "#4B47E5", to: "#8B5CF6", angle: 90 };

describe("gradientToCss / cssToGradient", () => {
  it("round-trips a two-stop gradient", () => {
    const css = gradientToCss(G);
    expect(css).toBe("linear-gradient(90deg, #4b47e5 0%, #8b5cf6 100%)");
    expect(cssToGradient(css)).toEqual({ from: "#4b47e5", to: "#8b5cf6", angle: 90 });
  });

  it("normalizes out-of-range angles", () => {
    expect(gradientToCss({ ...G, angle: 450 })).toContain("90deg");
    expect(gradientToCss({ ...G, angle: -90 })).toContain("270deg");
  });

  it("returns null for gradients richer than the editor models", () => {
    expect(cssToGradient("radial-gradient(circle, #fff, #000)")).toBeNull();
    expect(cssToGradient("")).toBeNull();
    expect(cssToGradient(null)).toBeNull();
  });
});

describe("isValidGradient", () => {
  it("requires two valid hexes and a finite angle", () => {
    expect(isValidGradient(G)).toBe(true);
    expect(isValidGradient({ from: "red", to: "#8B5CF6", angle: 90 })).toBe(false);
    expect(isValidGradient({ from: "#4B47E5", to: "#8B5CF6", angle: NaN })).toBe(false);
    expect(isValidGradient(null)).toBe(false);
  });
});

describe("gradientButtonStyleRaw → getBrandButtonCss", () => {
  it("emits the gradient fill for BOTH primary-button markers", () => {
    const brand = { ...DEFAULT_BRAND, buttonStyleRaw: gradientButtonStyleRaw(G, "#ffffff") };
    const css = getBrandButtonCss(brand);
    expect(css).toContain(".lp-brand-btn,.lp-cta-filled{");
    expect(css).toContain("background:linear-gradient(90deg, #4b47e5 0%, #8b5cf6 100%) !important");
    expect(css).toContain("color:#ffffff !important");
  });

  it("substitutes a legible label when the author's pick fails contrast on the first stop", () => {
    // #4B47E5 indigo with a near-identical label would publish an invisible
    // button; the shared resolver must swap in a contrasting colour.
    const brand = { ...DEFAULT_BRAND, buttonStyleRaw: gradientButtonStyleRaw(G, "#4B47E6") };
    const css = getBrandButtonCss(brand);
    expect(css).toContain("background:linear-gradient");
    expect(css).not.toContain("color:#4B47E6");
  });
});

describe("gradientFromOverrides", () => {
  it("reads a stored gradient back for the editor", () => {
    const overrides = { buttonStyleRaw: gradientButtonStyleRaw(G, "#ffffff") };
    expect(gradientFromOverrides(overrides)).toEqual({ from: "#4b47e5", to: "#8b5cf6", angle: 90 });
  });

  it("ignores solid/absent button styles", () => {
    expect(gradientFromOverrides({})).toBeNull();
    expect(gradientFromOverrides(null)).toBeNull();
    expect(gradientFromOverrides({
      buttonStyleRaw: { ...gradientButtonStyleRaw(G, "#fff"), background: { type: "solid", value: "#4B47E5" } },
    })).toBeNull();
  });
});
