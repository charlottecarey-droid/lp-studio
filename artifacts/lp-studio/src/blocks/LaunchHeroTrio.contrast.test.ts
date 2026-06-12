import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it, vi } from "vitest";

/**
 * Companion to `HeroCtaContrast.contrast.test.ts` for the 2026 launch-hero
 * trio (launch-spotlight-hero / bento-mosaic-hero / kinetic-type-hero): makes
 * sure every block's primary (filled) and secondary (outline) CTA stays
 * readable under the same adversarial brand palettes the other hero contrast
 * tests use. Each block is rendered through a pure, node-safe SSR pass and the
 * CTA inline colors are asserted against WCAG contrast.
 *
 * The blocks pull a few heavy, browser-only leaf components (image picker,
 * email-capture + Chili Piper + video modals) that are only used on
 * builder/modal paths — none of which these renders exercise. They reach for
 * `window` at import time, so stub them out.
 */
vi.mock("@/components/ImagePicker", () => ({ ImagePicker: () => null }));
vi.mock("@/components/EmailCaptureModal", () => ({ EmailCaptureModal: () => null }));
vi.mock("@/components/ChiliPiperButton", () => ({ ChiliPiperButton: () => null }));
vi.mock("@/components/ChiliPiperModal", () => ({ ChiliPiperModal: () => null }));
vi.mock("@/components/VideoModal", () => ({ VideoModal: () => null }));

import { BlockLaunchSpotlightHero } from "./BlockLaunchSpotlightHero";
import type { LaunchSpotlightHeroBlockProps } from "./BlockLaunchSpotlightHero";
import { BlockBentoMosaicHero } from "./BlockBentoMosaicHero";
import type { BentoMosaicHeroBlockProps } from "./BlockBentoMosaicHero";
import { BlockKineticTypeHero } from "./BlockKineticTypeHero";
import type { KineticTypeHeroBlockProps } from "./BlockKineticTypeHero";
import { DEFAULT_BRAND, relativeLuminance, type BrandConfig } from "@/lib/brand-config";

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
/** WCAG AA for normal text (button label vs. its fill / border vs. section). */
const TEXT_MIN = 4.5;

interface ButtonStyle {
  backgroundColor?: string;
  color?: string;
  borderColor?: string;
}

/**
 * Pull the inline style declarations out of every `<button …>` in the markup.
 * React serializes style objects as kebab-case `prop:value;` pairs. All three
 * blocks render their CTAs through the shared CtaButton (a motion.button), so
 * tag-scoping to <button> skips chips / tiles / accent-word spans.
 */
function buttonStyles(markup: string): ButtonStyle[] {
  const out: ButtonStyle[] = [];
  const re = /<button\b[^>]*?\sstyle="([^"]*)"/g;
  for (const match of markup.matchAll(re)) {
    const decls = match[1].split(";").filter(Boolean);
    const style: ButtonStyle = {};
    for (const decl of decls) {
      const idx = decl.indexOf(":");
      if (idx === -1) continue;
      const prop = decl.slice(0, idx).trim();
      const value = decl.slice(idx + 1).trim();
      if (prop === "background-color") style.backgroundColor = value;
      else if (prop === "background" && /^#[0-9a-fA-F]{3,8}$/.test(value)) style.backgroundColor = value;
      else if (prop === "color") style.color = value;
      else if (prop === "border-color") style.borderColor = value;
    }
    out.push(style);
  }
  return out;
}

/** Filled CTAs (primary) carry both a background-color and a color. */
function filledCtas(markup: string) {
  return buttonStyles(markup).filter(
    (s): s is Required<Pick<ButtonStyle, "backgroundColor" | "color">> =>
      !!s.backgroundColor && !!s.color,
  );
}

/** Outline CTAs (secondary) carry a border-color + color but no fill. */
function outlineCtas(markup: string) {
  return buttonStyles(markup).filter(
    (s): s is Required<Pick<ButtonStyle, "borderColor" | "color">> =>
      !!s.borderColor && !!s.color && !s.backgroundColor,
  );
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
    // Empty string ≙ unset for the contrast helpers (isValidHex("") is false),
    // and keeps this file type-clean under the focused tsc config.
    ctaBackground: "",
    ctaText: "",
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
    ctaBackground: "",
    ctaText: "",
  };
}

/** Assert every filled + outline CTA clears the contrast bars vs `surface`. */
function expectReadable(markup: string, surface: string) {
  const filled = filledCtas(markup);
  const outline = outlineCtas(markup);

  // Primary renders as a filled button; secondary as an outline button.
  expect(filled.length).toBeGreaterThanOrEqual(1);
  expect(outline.length).toBeGreaterThanOrEqual(1);

  for (const { backgroundColor, color } of filled) {
    // Fill must not collapse onto the section surface…
    expect(contrast(backgroundColor, surface)).toBeGreaterThanOrEqual(UI_MIN);
    // …and the label must be legible on that fill.
    expect(contrast(color, backgroundColor)).toBeGreaterThanOrEqual(TEXT_MIN);
  }
  for (const { borderColor, color } of outline) {
    // Outline border + label must both stand out from the section surface.
    expect(contrast(borderColor, surface)).toBeGreaterThanOrEqual(TEXT_MIN);
    expect(contrast(color, surface)).toBeGreaterThanOrEqual(TEXT_MIN);
  }
}

/** Default surfaces baked into each block (kept in sync with the components). */
const LAUNCH_DEFAULT_SURFACE = "#060609";
const BENTO_DARK_SURFACE = "#0A0A0F";
const KINETIC_LIGHT_SURFACE = "#FAFAF7";

describe("launch-spotlight-hero CTA contrast", () => {
  function render(brand: BrandConfig, bgColor?: string): string {
    const props = {
      headline: "The fastest way to ship beautiful products",
      ctaText: "Start for free",
      ctaUrl: "#",
      ctaAction: "url",
      ctaSecondaryText: "Watch the demo",
      ctaSecondaryUrl: "#",
      bgColor,
    } as LaunchSpotlightHeroBlockProps;
    return renderToStaticMarkup(
      createElement(BlockLaunchSpotlightHero, { props, brand }),
    );
  }

  it("keeps both CTAs readable for a same-hue brand on the default dark surface", () => {
    expectReadable(render(sameHueBrand()), LAUNCH_DEFAULT_SURFACE);
  });

  it("keeps both CTAs readable when the AI repaints the section in the brand blue", () => {
    expectReadable(render(sameHueBrand(), SAME_HUE), SAME_HUE);
  });

  it("passes a contrasting accent straight through as the primary fill", () => {
    const markup = render(contrastingBrand());
    expectReadable(markup, LAUNCH_DEFAULT_SURFACE);
    // The lime accent already clears the bar on the near-black surface, so the
    // helpers must use it verbatim (no black/white fallback).
    expect(filledCtas(markup)[0].backgroundColor.toLowerCase()).toBe(CONTRAST_ACCENT);
  });
});

describe("bento-mosaic-hero CTA contrast", () => {
  function render(
    brand: BrandConfig,
    overrides: Partial<BentoMosaicHeroBlockProps> = {},
  ): string {
    const props = {
      headline: "Everything your team ships, in one place",
      ctaText: "Get started",
      ctaUrl: "#",
      ctaAction: "url",
      ctaSecondaryText: "See it in action",
      ctaSecondaryUrl: "#",
      ...overrides,
    } as BentoMosaicHeroBlockProps;
    return renderToStaticMarkup(
      createElement(BlockBentoMosaicHero, { props, brand }),
    );
  }

  it("keeps both CTAs readable for a same-hue brand on the default dark theme", () => {
    expectReadable(render(sameHueBrand()), BENTO_DARK_SURFACE);
  });

  it("keeps both CTAs readable when the AI repaints the section in the brand blue", () => {
    expectReadable(render(sameHueBrand(), { bgColor: SAME_HUE }), SAME_HUE);
  });

  it("keeps both CTAs readable for a same-hue brand on the light theme", () => {
    const LIGHT = "#FAFAF8";
    expectReadable(render(sameHueBrand(), { theme: "light" }), LIGHT);
  });

  it("keeps both CTAs readable for a contrasting brand on its primary surface", () => {
    expectReadable(
      render(contrastingBrand(), { bgColor: CONTRAST_PRIMARY }),
      CONTRAST_PRIMARY,
    );
  });
});

describe("kinetic-type-hero CTA contrast", () => {
  function render(
    brand: BrandConfig,
    overrides: Partial<KineticTypeHeroBlockProps> = {},
  ): string {
    const props = {
      headline: "Make something people remember",
      ctaText: "Start building",
      ctaUrl: "#",
      ctaAction: "url",
      ctaSecondaryText: "Talk to us",
      ctaSecondaryUrl: "#",
      ...overrides,
    } as KineticTypeHeroBlockProps;
    return renderToStaticMarkup(
      createElement(BlockKineticTypeHero, { props, brand }),
    );
  }

  it("keeps both CTAs readable for a same-hue brand on the default light surface", () => {
    expectReadable(render(sameHueBrand()), KINETIC_LIGHT_SURFACE);
  });

  it("keeps both CTAs readable when the AI repaints the section in the brand blue", () => {
    expectReadable(render(sameHueBrand(), { bgColor: SAME_HUE }), SAME_HUE);
  });

  it("keeps both CTAs readable for a contrasting brand on the dark theme", () => {
    const DARK = "#0B0B0E";
    expectReadable(render(contrastingBrand(), { theme: "dark" }), DARK);
  });

  it("keeps the accent word legible (3.0 large-text bar) on every surface it styles", () => {
    // The accent word carries an inline `color` on a non-button span. Render
    // with the same-hue brand on its own blue surface — the worst case — and
    // assert the resolved accent ink still clears the large-text bar.
    const markup = render(sameHueBrand(), { bgColor: SAME_HUE, accentWordIndex: 1 });
    // Accent-styled spans are the only non-button elements with an inline
    // font-style/text-decoration + color pair; pull italic accent spans.
    const colors: string[] = [];
    for (const m of markup.matchAll(/<span[^>]*?\sstyle="([^"]*font-style:italic[^"]*)"/g)) {
      const c = m[1].match(/(?:^|;)\s*color:\s*(#[0-9a-fA-F]{3,8})/);
      if (c) colors.push(c[1]);
    }
    expect(colors.length).toBeGreaterThanOrEqual(1);
    for (const c of colors) {
      expect(contrast(c, SAME_HUE)).toBeGreaterThanOrEqual(UI_MIN);
    }
  });
});
