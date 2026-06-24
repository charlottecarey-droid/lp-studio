import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it, vi } from "vitest";

/**
 * Companion to `BlockFullBleedHero.contrast.test.ts`: makes sure the CTA fill of
 * *every other* hero/header block stays readable under two adversarial brand
 * palettes. Each block is rendered through a pure, node-safe SSR pass and the
 * primary CTA's inline colors are asserted against WCAG contrast.
 *
 * The hero blocks pull a few heavy, browser-only leaf components (image picker,
 * email-capture + Chili Piper + video modals) that are only used on
 * builder/modal paths — none of which these renders exercise. They reach for
 * `window` at import time, so stub them out.
 */
vi.mock("@/components/ImagePicker", () => ({ ImagePicker: () => null }));
vi.mock("@/components/EmailCaptureModal", () => ({ EmailCaptureModal: () => null }));
vi.mock("@/components/ChiliPiperButton", () => ({ ChiliPiperButton: () => null }));
vi.mock("@/components/ChiliPiperModal", () => ({ ChiliPiperModal: () => null }));
vi.mock("@/components/VideoModal", () => ({ VideoModal: () => null }));

import { BlockHero } from "./BlockHero";
import { BlockParallaxImageHero } from "./BlockParallaxImageHero";
import { BlockMagazineHero } from "./BlockMagazineHero";
import { BlockDandyProductHero } from "./BlockDandyProductHero";
import { BlockDandySiteHeader } from "./BlockDandySiteHeader";
import { BlockDandyHeroV7S3 } from "./BlockDandyHeroV7S3";
import { DEFAULT_BRAND, relativeLuminance, type BrandConfig } from "@/lib/brand-config";
import type {
  HeroBlockProps,
  ParallaxImageHeroBlockProps,
  MagazineHeroBlockProps,
  DandySiteHeaderBlockProps,
  DandyHeroV7S3BlockProps,
} from "@/lib/block-types";
import type { DandyProductHeroBlockProps } from "@/lib/block-types/dso-blocks";

/**
 * Recompute WCAG contrast from the exported `relativeLuminance` so the test is
 * independent of the (unexported) internal `contrastRatio` helper.
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

interface CtaColors {
  bg: string;
  color: string;
}

/**
 * Pull the inline fill + label color out of every opening `<tag …>` that
 * carries a `style="…"`. React serializes style objects as kebab-case
 * `prop:value;` pairs. Both the longhand `background-color` and the shorthand
 * `background:#hex` (used by the parallax pill) count as the fill. Only
 * elements that set BOTH a fill and a text color are returned — i.e. filled
 * CTAs, not bare links or sections.
 */
function filledCtas(markup: string, tag: "a" | "button"): CtaColors[] {
  const out: CtaColors[] = [];
  const re = new RegExp(`<${tag}\\b[^>]*?\\sstyle="([^"]*)"`, "g");
  for (const match of markup.matchAll(re)) {
    const decls = match[1].split(";").filter(Boolean);
    let bg: string | undefined;
    let color: string | undefined;
    for (const decl of decls) {
      const idx = decl.indexOf(":");
      if (idx === -1) continue;
      const prop = decl.slice(0, idx).trim();
      const value = decl.slice(idx + 1).trim();
      if (prop === "background-color") bg = value;
      else if (prop === "background" && /^#[0-9a-fA-F]{3,8}$/.test(value)) bg = value;
      else if (prop === "color") color = value;
    }
    if (bg && color) out.push({ bg, color });
  }
  return out;
}

/** Pull the inline `color:` off the first `<h1 … style="…">` (the headline). */
function headlineColor(markup: string): string | undefined {
  const m = /<h1\b[^>]*?\sstyle="([^"]*)"/.exec(markup);
  if (!m) return undefined;
  for (const decl of m[1].split(";")) {
    const idx = decl.indexOf(":");
    if (idx === -1) continue;
    if (decl.slice(0, idx).trim() === "color") return decl.slice(idx + 1).trim();
  }
  return undefined;
}

/**
 * The "blue-on-blue" trap: the hero sits on `primaryColor` and the accent is
 * the same blue, so a naive accent-colored CTA collapses onto the surface.
 */
const SAME_HUE = "#2d8cff";
function sameHueBrand(): BrandConfig {
  return {
    ...DEFAULT_BRAND,
    primaryColor: SAME_HUE,
    accentColor: SAME_HUE,
    ctaBackground: undefined,
    ctaText: undefined,
  };
}

/** A normal brand whose accent already contrasts on its (dark navy) surface. */
const CONTRAST_PRIMARY = "#0b1f3a";
const CONTRAST_ACCENT = "#c7e738";
function contrastingBrand(): BrandConfig {
  return {
    ...DEFAULT_BRAND,
    primaryColor: CONTRAST_PRIMARY,
    accentColor: CONTRAST_ACCENT,
    ctaBackground: undefined,
    ctaText: undefined,
  };
}

/** Assert every filled CTA clears both contrast bars against `surface`. */
function expectReadable(ctas: CtaColors[], surface: string) {
  expect(ctas.length).toBeGreaterThanOrEqual(1);
  for (const { bg, color } of ctas) {
    // Fill must not collapse onto the section surface…
    expect(contrast(bg, surface)).toBeGreaterThanOrEqual(UI_MIN);
    // …and the label must be legible on that fill.
    expect(contrast(color, bg)).toBeGreaterThanOrEqual(TEXT_MIN);
  }
}

describe("Hero/header CTA contrast across styles", () => {
  describe("BlockHero (dark hero surface = brand primary)", () => {
    function render(brand: BrandConfig): string {
      const props = {
        headline: "The dental lab your practice deserves",
        subheadline: "A digital-first lab.",
        ctaText: "Get started",
        ctaUrl: "#",
        ctaAction: "url",
        // Dark background → hero sits on the brand primary color.
        backgroundStyle: "dandy-green",
        // Skip the media + image render paths entirely.
        heroType: "none",
        imageUrl: "",
      } as HeroBlockProps;
      return renderToStaticMarkup(
        createElement(BlockHero, { props, brand, animationsEnabled: false }),
      );
    }

    it("keeps the hero CTA readable for a same-hue brand", () => {
      // Surface is the brand primary; only the hero CTA is a <button>
      // (the nav CTA is an <a> and is intentionally excluded).
      expectReadable(filledCtas(render(sameHueBrand()), "button"), SAME_HUE);
    });

    it("keeps the hero CTA readable for a contrasting brand", () => {
      expectReadable(filledCtas(render(contrastingBrand()), "button"), CONTRAST_PRIMARY);
    });
  });

  describe("BlockParallaxImageHero (fixed dark #0a0a0a surface)", () => {
    const SURFACE = "#0a0a0a";
    function render(brand: BrandConfig): string {
      const props = {
        imageUrl: "",
        eyebrow: "",
        referenceLabel: "",
        headline: "Built for modern practices",
        ctaText: "Get started",
        ctaUrl: "#",
        ctaStyle: "buttons",
        brandMark: "Brand",
        overlayOpacity: 40,
      } as ParallaxImageHeroBlockProps;
      return renderToStaticMarkup(
        createElement(BlockParallaxImageHero, { props, brand, animationsEnabled: false }),
      );
    }

    it("keeps the pill CTA readable for a same-hue brand", () => {
      expectReadable(filledCtas(render(sameHueBrand()), "a"), SURFACE);
    });

    it("keeps the pill CTA readable for a contrasting brand", () => {
      expectReadable(filledCtas(render(contrastingBrand()), "a"), SURFACE);
    });
  });

  describe("BlockMagazineHero (light surface, text-colored CTA)", () => {
    const BG = "#FAF7F2";
    function render(brand: BrandConfig): string {
      const props = {
        headline: "An editorial take on dental care",
        ctaText: "Get started",
        ctaUrl: "#",
        ctaAction: "url",
        layout: "split",
      } as MagazineHeroBlockProps;
      return renderToStaticMarkup(
        createElement(BlockMagazineHero, { props, brand, animationsEnabled: false }),
      );
    }

    it("keeps the CTA readable for a same-hue brand", () => {
      expectReadable(filledCtas(render(sameHueBrand()), "button"), BG);
    });

    it("keeps the CTA readable for a contrasting brand", () => {
      expectReadable(filledCtas(render(contrastingBrand()), "button"), BG);
    });
  });

  describe("BlockMagazineHero (dark 'cover' surface #0A0A0A)", () => {
    // The cover layout paints the section on a fixed near-black surface, yet the
    // default body `text` ink (`#0A0A0A`) would fill the primary CTA — a black
    // button on a black section. The block now resolves a surface-aware fill.
    const COVER_SURFACE = "#0a0a0a";
    function render(brand: BrandConfig): string {
      const props = {
        headline: "An editorial take on dental care",
        ctaText: "Get started",
        ctaUrl: "#",
        ctaAction: "url",
        layout: "cover",
        // No image → the scrim still sits over the near-black surface, but the
        // CTA contrast is measured against the worst-case solid cover surface.
        imageUrl: "",
      } as MagazineHeroBlockProps;
      return renderToStaticMarkup(
        createElement(BlockMagazineHero, { props, brand, animationsEnabled: false }),
      );
    }

    it("keeps the CTA readable for a same-hue brand", () => {
      expectReadable(filledCtas(render(sameHueBrand()), "button"), COVER_SURFACE);
    });

    it("keeps the CTA readable for a contrasting brand", () => {
      expectReadable(filledCtas(render(contrastingBrand()), "button"), COVER_SURFACE);
    });
  });

  describe("BlockDandyProductHero (split surface = backgroundColor)", () => {
    // This block reads its colors from props (backgroundColor / accentColor)
    // and takes a `block` wrapper rather than a flat `props` + `brand`.
    function render(surface: string, accent: string): string {
      const props = {
        headline: "Crowns, redefined",
        primaryCtaText: "Get started",
        ctaAction: "url",
        primaryCtaUrl: "#",
        variant: "split",
        backgroundColor: surface,
        accentColor: accent,
      } as DandyProductHeroBlockProps;
      return renderToStaticMarkup(
        createElement(BlockDandyProductHero, { block: { props } }),
      );
    }

    it("keeps the CTA readable for a same-hue brand", () => {
      const markup = render(SAME_HUE, SAME_HUE);
      expectReadable(filledCtas(markup, "button"), SAME_HUE);
    });

    it("keeps the CTA readable for a contrasting brand", () => {
      const markup = render(CONTRAST_PRIMARY, CONTRAST_ACCENT);
      expectReadable(filledCtas(markup, "button"), CONTRAST_PRIMARY);
    });
  });

  describe("BlockDandySiteHeader (surface = header backgroundColor)", () => {
    function render(brand: BrandConfig, surface: string): string {
      const props = {
        phoneNumber: "",
        phoneLabel: "",
        primaryCtaText: "Get started",
        primaryCtaUrl: "#",
        secondaryCtaText: "Sign in",
        secondaryCtaUrl: "#",
        navLinks: [],
        backgroundColor: surface,
      } as DandySiteHeaderBlockProps;
      return renderToStaticMarkup(
        createElement(BlockDandySiteHeader, { props, brand, animationsEnabled: false }),
      );
    }

    it("keeps the primary CTA readable for a same-hue brand", () => {
      expectReadable(filledCtas(render(sameHueBrand(), SAME_HUE), "button"), SAME_HUE);
    });

    it("keeps the primary CTA readable for a contrasting brand", () => {
      expectReadable(filledCtas(render(contrastingBrand(), CONTRAST_PRIMARY), "button"), CONTRAST_PRIMARY);
    });
  });

  describe("BlockDandyHeroV7S3 (surface = bgColor)", () => {
    function render(brand: BrandConfig, surface: string): string {
      const props = {
        headline: "Hero seven, style three",
        ctaText: "Get started",
        ctaAction: "url",
        ctaUrl: "#",
        bgColor: surface,
      } as DandyHeroV7S3BlockProps;
      return renderToStaticMarkup(
        createElement(BlockDandyHeroV7S3, { props, brand, animationsEnabled: false }),
      );
    }

    it("keeps the CTA readable for a same-hue brand", () => {
      expectReadable(filledCtas(render(sameHueBrand(), SAME_HUE), "button"), SAME_HUE);
    });

    it("keeps the CTA readable for a contrasting brand", () => {
      expectReadable(filledCtas(render(contrastingBrand(), CONTRAST_PRIMARY), "button"), CONTRAST_PRIMARY);
    });
  });

  // Regression: the inline-form variant on a PALE brand primary used to render a
  // hard-coded white headline and a white email input with a transparent border
  // — both invisible (white-on-white) on the light surface.
  describe("BlockDandyHeroV7S3 inline form on a pale surface", () => {
    const PALE = "#FAF7F2";
    function render(surface: string): string {
      const brand: BrandConfig = { ...DEFAULT_BRAND, primaryColor: surface };
      const props = {
        headline: "Hero seven, style three",
        subheadline: "A digital-first lab.",
        ctaText: "Get started",
        ctaAction: "inline-form",
        bgColor: surface,
        inputPlaceholder: "Enter your work email",
      } as DandyHeroV7S3BlockProps;
      return renderToStaticMarkup(
        createElement(BlockDandyHeroV7S3, { props, brand, animationsEnabled: false }),
      );
    }

    it("renders a readable (dark) headline, not white-on-white", () => {
      const color = headlineColor(render(PALE));
      expect(color).toBeDefined();
      expect(contrast(color!, PALE)).toBeGreaterThanOrEqual(TEXT_MIN);
    });

    it("gives the white email input a visible border on the pale surface", () => {
      const markup = render(PALE);
      expect(markup).toContain("border-slate-300");
      expect(markup).not.toMatch(/<input\b[^>]*border-transparent/);
    });
  });
});
