import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it, vi } from "vitest";

/**
 * Rendered-legibility regression guard for the `dso-heartland-hero` full-bleed
 * layout when a REAL tenant asset sits BEHIND the copy (a photo or a clip).
 *
 * Unit coverage in `generate-microsite.heroVariability.test.ts` proves the
 * sales route *selects* an asset-backed full-bleed treatment with a moderate
 * base overlay — but it never renders the result, so nothing catches a future
 * change that weakens or removes the legibility scrim / drops the brightened
 * subheadline. That regression would only surface visually, over a bright/busy
 * image, exactly where the muted-grey sub copy is the weakest element.
 *
 * Each case does a pure, node-safe SSR pass (the same approach the sibling
 * contrast tests use) and asserts, over a deliberately light/busy image and a
 * busy clip:
 *   • the asset itself is placed behind the copy (img/video src present),
 *   • BOTH dimming layers are present — the brand overlay tint AND the
 *     concentrated black legibility scrim above it,
 *   • the subheadline switches to a brightened near-white color.
 * A negative case (the curated gradient default, no asset) proves the scrim and
 * the brightening are conditional — so the default never regresses.
 *
 * Thresholds are HARDCODED here (not imported from the component) so this test
 * fails loudly if a future change weakens the scrim or the brightening. The
 * assertions describe the legibility contract, not the component's internals.
 *
 * The hero pulls a heavy, browser-only email-capture modal that is only used on
 * the modal submit paths (not exercised here) and reaches for `window` at
 * import time, so stub it out — matching the sibling hero render tests.
 */
vi.mock("@/components/EmailCaptureModal", () => ({ EmailCaptureModal: () => null }));

import { BlockDsoHeartlandHero } from "./BlockDsoHeartlandHero";
import { DEFAULT_BRAND } from "@/lib/brand-config";
import type { DsoHeartlandHeroBlockProps } from "@/lib/block-types";

// A light/busy photo + a busy clip — the adversarial assets the scrim exists
// for. The exact bytes don't matter (SSR never loads them); the URLs just have
// to flow through to the rendered img/video src.
const LIGHT_BUSY_IMAGE = "/objects/bright-busy-clinic-photo.jpg";
const BUSY_CLIP = "/objects/busy-handpiece-clip.mp4";

const SUBHEADLINE = "Partnered with the practices reshaping modern dentistry.";

// The darkest black scrim stop must stay at least this opaque, or text over a
// light/busy asset stops being readable. The shipped scrim peaks at 0.62.
const MIN_SCRIM_DARK_ALPHA = 0.55;
// The brightened subheadline must read as near-white and stay mostly opaque.
const MIN_NEAR_WHITE_CHANNEL = 230;
const MIN_NEAR_WHITE_ALPHA = 0.8;

function baseProps(
  overrides: Partial<DsoHeartlandHeroBlockProps> = {},
): DsoHeartlandHeroBlockProps {
  return {
    layout: "full-bleed",
    eyebrow: "Inside the partnership",
    headline: "A lab built for {growth}",
    subheadline: SUBHEADLINE,
    primaryCtaText: "Book a walkthrough",
    primaryCtaUrl: "#",
    secondaryCtaText: "See the work",
    secondaryCtaUrl: "#",
    // Moderate base tint, as the sales route sets for asset-backed full-bleed.
    overlayOpacity: 45,
    ...overrides,
  } as DsoHeartlandHeroBlockProps;
}

function render(props: DsoHeartlandHeroBlockProps): string {
  return renderToStaticMarkup(
    createElement(BlockDsoHeartlandHero, { props, brand: DEFAULT_BRAND }),
  );
}

/**
 * Pull the inline `style="…"` of the element that renders the given text.
 * React serializes style objects as kebab-case `prop:value;` pairs; the text is
 * HTML-escaped, but our sample copy has no special characters.
 */
function styleOfElementContaining(markup: string, text: string): string {
  const re = new RegExp(`<[a-z][^>]*\\sstyle="([^"]*)"[^>]*>${text}<`, "i");
  const match = markup.match(re);
  expect(match, `expected an element rendering "${text}"`).not.toBeNull();
  return match![1];
}

/** Parse `prop: value` out of a serialized inline style string. */
function colorOf(style: string): string | undefined {
  for (const decl of style.split(";")) {
    const idx = decl.indexOf(":");
    if (idx === -1) continue;
    if (decl.slice(0, idx).trim() === "color") return decl.slice(idx + 1).trim();
  }
  return undefined;
}

/**
 * The brand overlay tint is the `<div>` whose inline style carries both a
 * background-color and an opacity (the scrim, by contrast, uses the `background`
 * shorthand with a gradient and no opacity). Returns true when at least one
 * such layer is present.
 */
function hasOverlayTintLayer(markup: string): boolean {
  for (const m of markup.matchAll(/style="([^"]*)"/g)) {
    const style = m[1];
    if (/background-color\s*:/.test(style) && /(?:^|;)\s*opacity\s*:/.test(style)) {
      return true;
    }
  }
  return false;
}

/**
 * Every black-scrim alpha stop rendered in a gradient anywhere in the markup.
 * The legibility scrim is the only pure-black gradient (`linear-gradient(…
 * rgba(0,0,0,a)…)`); the overlay tint is a brand color, and decorative
 * text/box shadows use `rgba(0,0,0,a)` outside any gradient — neither matches.
 * An empty array means no scrim is present.
 */
function scrimDarkAlphas(markup: string): number[] {
  const alphas: number[] = [];
  for (const attr of markup.matchAll(/style="([^"]*)"/g)) {
    const style = attr[1];
    // Only a gradient layer counts as a scrim; decorative text/box shadows use
    // rgba(0,0,0,a) outside any gradient and must not be mistaken for one.
    if (!/linear-gradient/.test(style)) continue;
    for (const m of style.matchAll(
      /rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*([\d.]+)\s*\)/g,
    )) {
      alphas.push(parseFloat(m[1]));
    }
  }
  return alphas;
}

/** True when a color reads as a brightened, mostly-opaque near-white. */
function isBrightenedNearWhite(color: string | undefined): boolean {
  if (!color) return false;
  const m = color.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/,
  );
  if (!m) return false;
  const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const a = m[4] === undefined ? 1 : parseFloat(m[4]);
  return (
    r >= MIN_NEAR_WHITE_CHANNEL &&
    g >= MIN_NEAR_WHITE_CHANNEL &&
    b >= MIN_NEAR_WHITE_CHANNEL &&
    a >= MIN_NEAR_WHITE_ALPHA
  );
}

describe("BlockDsoHeartlandHero full-bleed legibility", () => {
  it("keeps copy readable over a light/busy background IMAGE", () => {
    const markup = render(baseProps({ backgroundImageUrl: LIGHT_BUSY_IMAGE }));

    // The photo sits behind the copy.
    expect(markup).toContain(`src="${LIGHT_BUSY_IMAGE}"`);

    // Brand overlay tint AND the concentrated black legibility scrim are both
    // present, and the scrim's darkest stop stays opaque enough to be effective.
    expect(hasOverlayTintLayer(markup)).toBe(true);
    const alphas = scrimDarkAlphas(markup);
    expect(alphas.length).toBeGreaterThan(0);
    expect(Math.max(...alphas)).toBeGreaterThanOrEqual(MIN_SCRIM_DARK_ALPHA);

    // The subheadline brightens to near-white over the asset.
    const subStyle = styleOfElementContaining(markup, SUBHEADLINE);
    expect(isBrightenedNearWhite(colorOf(subStyle))).toBe(true);
  });

  it("keeps copy readable over a busy background VIDEO clip", () => {
    const markup = render(baseProps({ backgroundVideoUrl: BUSY_CLIP }));

    // The clip plays behind the copy.
    expect(markup).toContain(`src="${BUSY_CLIP}"`);

    expect(hasOverlayTintLayer(markup)).toBe(true);
    const alphas = scrimDarkAlphas(markup);
    expect(alphas.length).toBeGreaterThan(0);
    expect(Math.max(...alphas)).toBeGreaterThanOrEqual(MIN_SCRIM_DARK_ALPHA);

    const subStyle = styleOfElementContaining(markup, SUBHEADLINE);
    expect(isBrightenedNearWhite(colorOf(subStyle))).toBe(true);
  });

  it("does NOT scrim or brighten the curated gradient default (no asset)", () => {
    const markup = render(baseProps());

    // No asset behind the copy on the gradient default.
    expect(markup).not.toContain("<img");
    expect(markup).not.toContain("<video");

    // The black legibility scrim is reserved for asset-backed branches only.
    expect(scrimDarkAlphas(markup).length).toBe(0);

    // The subheadline keeps the muted tone (not the brightened near-white).
    const subStyle = styleOfElementContaining(markup, SUBHEADLINE);
    expect(isBrightenedNearWhite(colorOf(subStyle))).toBe(false);
  });
});
