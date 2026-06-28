import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it, vi } from "vitest";

/**
 * Accent-legibility regression guard for the always-dark `dso-scroll-story-hero`,
 * mirroring `BlockDsoHeartlandHero.legibility.test.ts`.
 *
 * This hero forces near-white copy on a dark text panel, so it is always a dark
 * surface. The eyebrow, the active progress-dot fill, and the CTA fill used to
 * be painted with the raw brand accent (`var(--brand-accent)` /
 * `brand.accentColor`). When a tenant's brand accent is itself dark those
 * elements vanished into the panel.
 *
 * These cases render the hero with (a) a deliberately DARK brand accent and
 * assert the eyebrow resolves to a contrasting, non-dark color, the CTA fill
 * stands off the dark panel, and the CTA label contrasts its own fill; and (b) a
 * BRIGHT brand accent and assert it is passed through unchanged. Thresholds are
 * hardcoded so the contract fails loudly if a future change drops the guard.
 *
 * The CTA pulls heavy, browser-only leaf components (email-capture + Chili Piper
 * + video modals) that reach for `window` at import time and are never used on
 * this render path — stub them, matching the sibling hero render tests.
 */
vi.mock("@/components/ImagePicker", () => ({ ImagePicker: () => null }));
vi.mock("@/components/EmailCaptureModal", () => ({ EmailCaptureModal: () => null }));
vi.mock("@/components/ChiliPiperButton", () => ({ ChiliPiperButton: () => null }));
vi.mock("@/components/ChiliPiperModal", () => ({ ChiliPiperModal: () => null }));
vi.mock("@/components/VideoModal", () => ({ VideoModal: () => null }));

import { BlockDsoScrollStoryHero } from "./BlockDsoScrollStoryHero";
import { DEFAULT_BRAND, type BrandConfig } from "@/lib/brand-config";
import type { DsoScrollStoryHeroBlockProps } from "@/lib/block-types/dso-blocks";

// A near-black brand accent — the adversarial case that vanished into the panel.
const DARK_ACCENT = "#1e1b4b"; // indigo-950
// A bright brand accent (Dandy lime) that must be used unchanged.
const BRIGHT_ACCENT = "#C7E738";

// Accent elements must be readable on the dark panel. A resolved color this
// luminous reads clearly against a near-black surface.
const MIN_READABLE_ACCENT_LUMINANCE = 0.5;
// The CTA fill must stand off the dark panel, and its label must clear AA (4.5).
const MIN_CTA_BG_LUMINANCE = 0.3;
const MIN_LABEL_ON_FILL_CONTRAST = 4.5;

const EYEBROW = "Why teams choose us";
const CTA_LABEL = "Request a Demo";

function darkProps(): DsoScrollStoryHeroBlockProps {
  return {
    eyebrow: EYEBROW,
    chapters: [
      { headline: "First chapter headline.", body: "First chapter body." },
    ],
    ctaText: CTA_LABEL,
    ctaUrl: "#",
    ctaAction: "url",
    backgroundStyle: "dark",
  } as DsoScrollStoryHeroBlockProps;
}

function renderWithAccent(accentColor: string): string {
  const brand: BrandConfig = { ...DEFAULT_BRAND, accentColor };
  return renderToStaticMarkup(
    createElement(BlockDsoScrollStoryHero, { props: darkProps(), brand }),
  );
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
 * The eyebrow color sits on the wrapping `<p>`; the text is rendered by a nested
 * InlineText `<span>`. Capture the wrapper's inline style.
 */
function eyebrowColor(markup: string): string | undefined {
  const m = new RegExp(
    `<p\\b[^>]*\\sstyle="([^"]*)"[^>]*>\\s*<span\\b[^>]*>${EYEBROW}<`,
    "i",
  ).exec(markup);
  expect(m, "expected the eyebrow paragraph element").not.toBeNull();
  return colorOf(m![1]);
}

interface CtaColors {
  bg: string;
  color: string;
}

/**
 * Pull the inline fill + label color out of every filled `<button>`. The CTA
 * uses the `background` shorthand with a hex; the progress dots set a `background`
 * but no text color, so only the real CTA is returned.
 */
function filledButtons(markup: string): CtaColors[] {
  const out: CtaColors[] = [];
  for (const match of markup.matchAll(/<button\b[^>]*?\sstyle="([^"]*)"/g)) {
    let bg: string | undefined;
    let color: string | undefined;
    for (const decl of match[1].split(";")) {
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

/** Relative luminance (sRGB) of a #rrggbb color, 0 (black) … 1 (white). */
function luminance(hex: string): number {
  const m = hex.match(/^#?([0-9a-f]{6})$/i);
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  const ch = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const r = ch((n >> 16) & 0xff);
  const g = ch((n >> 8) & 0xff);
  const b = ch(n & 0xff);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two #rrggbb colors. */
function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

function normHex(color: string | undefined): string {
  return (color ?? "").trim().toLowerCase();
}

describe("BlockDsoScrollStoryHero accent legibility on the dark panel", () => {
  it("rescues a DARK brand accent to a readable color across accent elements", () => {
    const markup = renderWithAccent(DARK_ACCENT);

    // The raw dark accent never appears as a literal color anywhere.
    expect(markup.toLowerCase()).not.toContain(DARK_ACCENT.toLowerCase());

    // Eyebrow resolves to a clearly readable (light) color, not the dark accent.
    const eyebrow = eyebrowColor(markup);
    expect(normHex(eyebrow)).not.toBe(normHex(DARK_ACCENT));
    expect(luminance(eyebrow ?? "")).toBeGreaterThanOrEqual(
      MIN_READABLE_ACCENT_LUMINANCE,
    );

    // The CTA fill stands off the dark panel and its label contrasts the fill.
    const ctas = filledButtons(markup);
    expect(ctas.length).toBeGreaterThanOrEqual(1);
    const { bg, color } = ctas[0];
    expect(normHex(bg)).not.toBe(normHex(DARK_ACCENT));
    expect(luminance(bg)).toBeGreaterThanOrEqual(MIN_CTA_BG_LUMINANCE);
    expect(contrast(bg, color)).toBeGreaterThanOrEqual(MIN_LABEL_ON_FILL_CONTRAST);
  });

  it("passes a BRIGHT brand accent through unchanged", () => {
    const markup = renderWithAccent(BRIGHT_ACCENT);

    // The bright accent is contrast-safe, so the eyebrow keeps it.
    expect(normHex(eyebrowColor(markup))).toBe(normHex(BRIGHT_ACCENT));

    // …and so does the CTA fill.
    const ctas = filledButtons(markup);
    expect(ctas.length).toBeGreaterThanOrEqual(1);
    expect(normHex(ctas[0].bg)).toBe(normHex(BRIGHT_ACCENT));
  });
});
