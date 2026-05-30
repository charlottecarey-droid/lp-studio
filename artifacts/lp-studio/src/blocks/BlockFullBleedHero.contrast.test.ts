import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it, vi } from "vitest";

/**
 * The hero imports a few heavy, browser-only leaf components (image picker,
 * email-capture + Chili Piper modals) that are only rendered in builder/modal
 * paths — none of which this test exercises. They pull `window` in at import
 * time, so stub them out to keep the render a pure, node-safe SSR pass that
 * still goes through the real CTA color wiring under test.
 */
vi.mock("@/components/ImagePicker", () => ({ ImagePicker: () => null }));
vi.mock("@/components/EmailCaptureModal", () => ({ EmailCaptureModal: () => null }));
vi.mock("./ChiliPiperModal", () => ({ ChiliPiperModal: () => null }));

import { BlockFullBleedHero } from "./BlockFullBleedHero";
import {
  DEFAULT_BRAND,
  relativeLuminance,
  type BrandConfig,
} from "@/lib/brand-config";
import type { FullBleedHeroBlockProps } from "@/lib/block-types";

/**
 * Recompute WCAG contrast from the exported `relativeLuminance` so the test is
 * independent of the (unexported) internal `contrastRatio` helper — the same
 * approach used by `cta-button-contrast.test.ts`.
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

interface InlineStyle {
  backgroundColor?: string;
  color?: string;
  borderColor?: string;
}

/**
 * Pull every inline `style="..."` block out of the rendered markup and parse
 * the color-relevant declarations. React serializes style objects as
 * kebab-case `prop:value;` pairs.
 */
function extractStyles(markup: string): InlineStyle[] {
  const out: InlineStyle[] = [];
  for (const match of markup.matchAll(/style="([^"]*)"/g)) {
    const decls = match[1].split(";").filter(Boolean);
    const style: InlineStyle = {};
    for (const decl of decls) {
      const idx = decl.indexOf(":");
      if (idx === -1) continue;
      const prop = decl.slice(0, idx).trim();
      const value = decl.slice(idx + 1).trim();
      if (prop === "background-color") style.backgroundColor = value;
      else if (prop === "color") style.color = value;
      else if (prop === "border-color") style.borderColor = value;
    }
    out.push(style);
  }
  return out;
}

/** Filled CTAs (primary + header) carry both a background-color and a color. */
function filledButtons(styles: InlineStyle[]): Required<Pick<InlineStyle, "backgroundColor" | "color">>[] {
  return styles
    .filter((s) => s.backgroundColor && s.color)
    .map((s) => ({ backgroundColor: s.backgroundColor!, color: s.color! }));
}

/** The outline (secondary) CTA is the only element with an inline border-color. */
function outlineButtons(styles: InlineStyle[]): Required<Pick<InlineStyle, "borderColor" | "color">>[] {
  return styles
    .filter((s) => s.borderColor && s.color)
    .map((s) => ({ borderColor: s.borderColor!, color: s.color! }));
}

function baseProps(overrides: Partial<FullBleedHeroBlockProps> = {}): FullBleedHeroBlockProps {
  return {
    headline: "The dental lab your practice has been waiting for",
    subheadline: "A digital-first lab.",
    ctaText: "Get started",
    ctaUrl: "#",
    // Plain URL action so the EmailCaptureModal render path stays inert.
    ctaAction: "url",
    secondaryCtaText: "See how it works",
    secondaryCtaUrl: "#",
    // Image (not video) background avoids the video/mute-toggle render path.
    backgroundType: "image",
    backgroundImageUrl: "",
    overlayOpacity: 55,
    minHeight: "full",
    contentAlignment: "center",
    logoUrl: "#",
    navLinks: [],
    headerCtaText: "Get started",
    headerCtaUrl: "#",
    ...overrides,
  };
}

function render(brand: BrandConfig, props: FullBleedHeroBlockProps): string {
  // No `onFieldChange` → builder-only popovers/pickers are not rendered.
  return renderToStaticMarkup(
    createElement(BlockFullBleedHero, { props, brand, animationsEnabled: false }),
  );
}

describe("BlockFullBleedHero CTA contrast", () => {
  it("keeps every CTA readable for a same-hue brand (blue accent ≈ blue primary)", () => {
    // Zoom-style palette: the hero sits on `primaryColor`, and both the accent
    // and primary are the same blue — the classic "blue-on-blue" trap.
    const sameHueBlue = "#2d8cff";
    const brand: BrandConfig = {
      ...DEFAULT_BRAND,
      primaryColor: sameHueBlue,
      accentColor: sameHueBlue,
      ctaBackground: undefined,
      ctaText: undefined,
    };

    const markup = render(brand, baseProps());
    const styles = extractStyles(markup);

    const filled = filledButtons(styles);
    const outline = outlineButtons(styles);

    // Primary CTA + header CTA both render as filled buttons.
    expect(filled.length).toBeGreaterThanOrEqual(2);
    // Secondary CTA renders as an outline button.
    expect(outline.length).toBeGreaterThanOrEqual(1);

    for (const { backgroundColor, color } of filled) {
      // Fill must not collapse onto the same-hue hero surface…
      expect(contrast(backgroundColor, sameHueBlue)).toBeGreaterThanOrEqual(UI_MIN);
      // …and the label must be legible on that fill.
      expect(contrast(color, backgroundColor)).toBeGreaterThanOrEqual(TEXT_MIN);
    }

    for (const { borderColor, color } of outline) {
      // Outline border + label must both stand out from the hero surface.
      expect(contrast(borderColor, sameHueBlue)).toBeGreaterThanOrEqual(TEXT_MIN);
      expect(contrast(color, sameHueBlue)).toBeGreaterThanOrEqual(TEXT_MIN);
    }
  });

  it("leaves the CTA colors unchanged for a brand whose accent already contrasts", () => {
    // Dark navy hero surface with a bright lime accent that already clears the
    // contrast bar — the helpers should pass the accent straight through.
    const primary = "#0b1f3a";
    const accent = "#c7e738";
    const brand: BrandConfig = {
      ...DEFAULT_BRAND,
      primaryColor: primary,
      accentColor: accent,
      ctaBackground: undefined,
      ctaText: undefined,
    };

    const markup = render(brand, baseProps());
    const styles = extractStyles(markup);

    const filled = filledButtons(styles);
    const outline = outlineButtons(styles);

    expect(filled.length).toBeGreaterThanOrEqual(2);
    expect(outline.length).toBeGreaterThanOrEqual(1);

    // Accent already contrasts on the navy surface, so it is used verbatim
    // (no black/white fallback) for the filled CTAs.
    for (const { backgroundColor, color } of filled) {
      expect(backgroundColor.toLowerCase()).toBe(accent);
      expect(contrast(backgroundColor, primary)).toBeGreaterThanOrEqual(UI_MIN);
      expect(contrast(color, backgroundColor)).toBeGreaterThanOrEqual(TEXT_MIN);
    }

    // The outline CTA prefers the primary color; on its own primary surface
    // that fails contrast, so the brand's primary is replaced by a legible
    // fallback. Either way it must clear the text contrast bar.
    for (const { borderColor, color } of outline) {
      expect(contrast(borderColor, primary)).toBeGreaterThanOrEqual(TEXT_MIN);
      expect(contrast(color, primary)).toBeGreaterThanOrEqual(TEXT_MIN);
    }
  });
});
