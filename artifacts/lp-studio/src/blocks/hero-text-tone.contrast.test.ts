import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it, vi } from "vitest";

/**
 * Rendered text-tone regression guard for the two hero blocks whose light/dark
 * heading tone is driven by `resolveSectionSurface(..., brand).isDark`
 * (BlockHero, BlockDsoPracticeHero).
 *
 * The bug class this protects against is invisible hero text: white heading on a
 * light surface, or dark heading on a dark image. It only shows up *visually*
 * and depends on the tenant's brand color, so it is easy to silently
 * reintroduce. The fix routes the tone decision through `resolveSectionSurface`
 * so a preset's REAL painted color (tenant override → brand primary → default)
 * decides darkness — but that fix had no automated guard. The two latent cases
 * it fixed are covered explicitly:
 *   1. The "Brand color" (dandy-green) preset with a PALE brand primary renders
 *      a LIGHT hero; the old key-based check kept it "dark" and emitted white
 *      text → invisible. Here a pale-primary brand must pick the DARK heading.
 *   2. A background-IMAGE DSO hero paints a cover photo behind the copy; the old
 *      key-based check could read a light/unset preset as "light" and use dark
 *      text over a dark photo. Here the cover image must force the LIGHT heading.
 *
 * Each case does a pure, node-safe SSR pass (the sibling contrast tests' method)
 * and asserts the rendered heading tone:
 *   • MATCHES an INDEPENDENT WCAG-luminance oracle for the surface darkness, and
 *   • CONTRASTS the resolved surface (a canonical ink for the chosen tone clears
 *     the WCAG AA 4.5:1 text bar against the surface the hero paints).
 * The oracle re-derives luminance locally (not via the modules under guard) so a
 * regression to the old preset-KEY logic diverges from it and fails the test.
 *
 * The hero blocks pull heavy, browser-only leaf components (image picker,
 * email-capture / Chili Piper / video modals) that reach for `window` at import
 * time and are not exercised here, so stub them out (matching the siblings).
 */
vi.mock("@/components/ImagePicker", () => ({ ImagePicker: () => null }));
vi.mock("@/components/EmailCaptureModal", () => ({ EmailCaptureModal: () => null }));
vi.mock("@/components/ChiliPiperButton", () => ({ ChiliPiperButton: () => null }));
vi.mock("@/components/ChiliPiperModal", () => ({ ChiliPiperModal: () => null }));
vi.mock("@/components/VideoModal", () => ({ VideoModal: () => null }));

import { BlockHero } from "./BlockHero";
import { BlockDsoPracticeHero } from "./BlockDsoPracticeHero";
import { DEFAULT_BRAND, type BrandConfig } from "@/lib/brand-config";
import type { HeroBlockProps, DsoPracticeHeroBlockProps } from "@/lib/block-types";

/* ── independent WCAG color math (NOT imported from the code under guard) ───── */

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 1;
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [lo, hi] = la < lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** WCAG AA for normal text. */
const TEXT_MIN = 4.5;

/** Two adversarial brand primaries: a near-black forest and a pale pastel. The
 *  pale one is the production-bug palette that exposed the key-based tone bug. */
const DARK_PRIMARY = "#003A30";
const PALE_PRIMARY = "#F4C2D7";
function brand(primaryColor: string): BrandConfig {
  return { ...DEFAULT_BRAND, primaryColor };
}

/** The presets whose darkness this fix routes through resolveSectionSurface. */
type Preset = "white" | "muted" | "dark" | "gradient" | "dandy-green";
const PRESETS: Preset[] = ["white", "muted", "dark", "gradient", "dandy-green"];

/**
 * INDEPENDENT oracle: the concrete hex each preset actually paints for a brand,
 * derived without touching the modules under guard. The gradient always fades
 * into fixed near-black stops, so it is dark regardless of its first stop.
 */
function presetSurfaceHex(preset: Preset, primaryColor: string): string {
  switch (preset) {
    case "white": return "#ffffff";
    case "muted": return "#f6f4ef";
    case "dark": return "#1a1a1a";
    case "gradient": return "#0f172a"; // fixed dark stops
    case "dandy-green": return primaryColor; // "Brand color" → --brand-primary
  }
}
function expectedSurfaceIsDark(preset: Preset, primaryColor: string): boolean {
  if (preset === "gradient") return true;
  return luminance(presetSurfaceHex(preset, primaryColor)) < 0.4;
}

type Tone = "light" | "dark";
/** Canonical text ink for an asserted tone (white vs near-black). */
function inkFor(tone: Tone): string {
  return tone === "light" ? "#ffffff" : "#0b0b0f";
}

/** Detect BlockHero's heading tone from its CSS-var heading token class. */
function heroHeadingTone(markup: string): Tone {
  const onDark = markup.includes("--brand-heading-on-dark");
  const onLight = markup.includes("--brand-heading-on-light");
  expect(onDark || onLight, "expected a hero heading tone token").toBe(true);
  expect(onDark && onLight, "expected exactly one hero heading tone").toBe(false);
  return onDark ? "light" : "dark";
}

/** Pull the inline `color:` declaration off the first `<h1 …>` in the markup. */
function h1Color(markup: string): string {
  const m = markup.match(/<h1\b[^>]*\sstyle="([^"]*)"/i);
  expect(m, "expected an <h1> with an inline style").not.toBeNull();
  for (const decl of m![1].split(";")) {
    const idx = decl.indexOf(":");
    if (idx === -1) continue;
    if (decl.slice(0, idx).trim() === "color") return decl.slice(idx + 1).trim();
  }
  throw new Error("no color declaration on the <h1>");
}

/** Detect BlockDsoPracticeHero's heading tone from its inline `color`. The dark
 *  tone resolves to `var(--brand-primary, …)`; the light tone is `#fff`. */
function dsoHeadingTone(markup: string): Tone {
  const color = h1Color(markup);
  if (/^#fff(f{0,4})?$/i.test(color) || /rgb\(\s*255/.test(color)) return "light";
  if (color.includes("--brand-primary")) return "dark";
  throw new Error(`unrecognized DSO heading color: ${color}`);
}

/**
 * The contract: the tone the hero rendered must (a) equal the independent
 * darkness oracle's expectation and (b) clear WCAG AA against the surface.
 */
function expectToneFitsSurface(tone: Tone, surfaceIsDark: boolean, surfaceHex: string) {
  expect(tone).toBe(surfaceIsDark ? "light" : "dark");
  expect(contrast(inkFor(tone), surfaceHex)).toBeGreaterThanOrEqual(TEXT_MIN);
}

/* ── renderers ─────────────────────────────────────────────────────────────── */

function renderHero(preset: Preset, primaryColor: string): string {
  const props = {
    headline: "The dental lab your practice deserves",
    subheadline: "A digital-first lab.",
    ctaText: "Get started",
    ctaUrl: "#",
    ctaAction: "url",
    backgroundStyle: preset,
    heroType: "none",
    imageUrl: "",
  } as HeroBlockProps;
  return renderToStaticMarkup(
    createElement(BlockHero, { props, brand: brand(primaryColor), animationsEnabled: false }),
  );
}

function renderDso(
  preset: Preset,
  primaryColor: string,
  extra: Partial<DsoPracticeHeroBlockProps> = {},
): string {
  const props = {
    headline: "Your practice. Elevated.",
    subheadline: "A digital-first lab.",
    primaryCtaText: "Get started",
    primaryCtaUrl: "#",
    backgroundStyle: preset,
    layout: "centered",
    ...extra,
  } as DsoPracticeHeroBlockProps;
  return renderToStaticMarkup(
    createElement(BlockDsoPracticeHero, { props, brand: brand(primaryColor) }),
  );
}

/* ── tests ─────────────────────────────────────────────────────────────────── */

describe("Hero heading tone contrasts its surface across presets & brands", () => {
  for (const primaryColor of [DARK_PRIMARY, PALE_PRIMARY]) {
    const label = primaryColor === DARK_PRIMARY ? "dark-primary" : "pale-primary";

    describe(`BlockHero (${label} brand)`, () => {
      for (const preset of PRESETS) {
        it(`keeps the headline legible on the "${preset}" preset`, () => {
          const tone = heroHeadingTone(renderHero(preset, primaryColor));
          expectToneFitsSurface(
            tone,
            expectedSurfaceIsDark(preset, primaryColor),
            presetSurfaceHex(preset, primaryColor),
          );
        });
      }
    });

    describe(`BlockDsoPracticeHero (${label} brand)`, () => {
      for (const preset of PRESETS) {
        it(`keeps the headline legible on the "${preset}" preset`, () => {
          const tone = dsoHeadingTone(renderDso(preset, primaryColor));
          expectToneFitsSurface(
            tone,
            expectedSurfaceIsDark(preset, primaryColor),
            presetSurfaceHex(preset, primaryColor),
          );
        });
      }
    });
  }

  // Latent case #1: the "Brand color" preset with a PALE primary must NOT keep
  // the old key-based white text (which went invisible on the light surface).
  it('BlockHero picks DARK heading on the pale-primary "Brand color" preset', () => {
    expect(heroHeadingTone(renderHero("dandy-green", PALE_PRIMARY))).toBe("dark");
  });
  it('BlockDsoPracticeHero picks DARK heading on the pale-primary "Brand color" preset', () => {
    expect(dsoHeadingTone(renderDso("dandy-green", PALE_PRIMARY))).toBe("dark");
  });

  // Latent case #2: a background-IMAGE DSO hero treats the cover photo as a dark
  // surface, so even a LIGHT preset + pale primary must pick the LIGHT heading
  // (white over the dimmed photo) — never dark text on a dark image.
  it("BlockDsoPracticeHero picks LIGHT heading over a background image (light preset, pale primary)", () => {
    const markup = renderDso("white", PALE_PRIMARY, {
      layout: "bg-image",
      imageUrl: "/objects/clinic-cover.jpg",
    });
    expect(markup).toContain("/objects/clinic-cover.jpg");
    const tone = dsoHeadingTone(markup);
    expect(tone).toBe("light");
    // The cover image + scrim reads as a dark surface; white text clears AA.
    expect(contrast(inkFor(tone), "#0f172a")).toBeGreaterThanOrEqual(TEXT_MIN);
  });
});
