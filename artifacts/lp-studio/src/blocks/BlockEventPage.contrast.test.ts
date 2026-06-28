import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it, vi } from "vitest";

/**
 * `useBlockFonts` injects <link> tags into `document.head` in an effect; under
 * `renderToStaticMarkup` effects never run, but stub it anyway so the import is
 * inert and the SSR pass stays pure/node-safe. The carousel + parallax hooks
 * (embla / framer `useScroll`) only wire up listeners in effects, so they are
 * harmless during a static render.
 */
vi.mock("@/lib/use-block-fonts", () => ({ useBlockFonts: () => {} }));

import { BlockEventPage, resolveTheme } from "./BlockEventPage";
import { createBlock } from "@/lib/block-types";
import { relativeLuminance } from "@/lib/brand-config";
import type { EventPageBlockProps, EventPageTheme } from "@/lib/block-types";

/**
 * Recompute WCAG contrast from the exported `relativeLuminance` so the test is
 * independent of the block's internal color math — mirrors
 * `BlockFullBleedHero.contrast.test.ts`.
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
 * The hero always paints over a cover photo, so its text contrasts a DARK
 * scrim regardless of the theme palette. Replicate the block's scrim-base rule
 * (theme bg when already dark, else near-black) as an independent oracle.
 */
function heroScrimBase(bg: string): string {
  return relativeLuminance(bg) < 0.4 ? bg : "#0b0b0f";
}

/** The light/imported theme that triggered the original invisible-text bug. */
const LIGHT_THEME: EventPageTheme = {
  bg: "#ffffff",
  cardBg: "#f4f4f5",
  fg: "#1a1a1a",
  headingColor: "#111111",
  primary: "#3b3b3b",
  muted: "#555555",
  border: "#dddddd",
  navBg: "#ffffff",
  navBgOpacity: 0.9,
  navText: "#111111",
};

function eventProps(theme: EventPageTheme | undefined): EventPageBlockProps {
  const block = createBlock("event-page");
  return {
    ...block.props,
    // ASCII-only markers so each hero element is locatable in the markup.
    eventName: "HEADLINEMARKER",
    heroEyebrow: "EYEBROWMARKER",
    heroTagline: "TAGLINEMARKER",
    theme,
  };
}

/**
 * Pull the inline `color:` declaration off the element whose text is `marker`.
 * `eventName` is also rendered in the sticky nav, so the caller can pin the
 * lookup to a specific tag (e.g. the hero `<h1>`) to avoid matching it.
 */
function colorOf(markup: string, marker: string, tag = ""): string {
  const re = new RegExp(`<${tag}[^>]*style="([^"]*)"[^>]*>[^<]*${marker}`);
  const m = markup.match(re);
  expect(m, `element containing "${marker}" not found in markup`).toBeTruthy();
  const decls = m![1].split(";");
  for (const decl of decls) {
    const idx = decl.indexOf(":");
    if (idx === -1) continue;
    if (decl.slice(0, idx).trim() === "color") return decl.slice(idx + 1).trim();
  }
  throw new Error(`no color declaration on element containing "${marker}"`);
}

function render(theme: EventPageTheme | undefined): string {
  return renderToStaticMarkup(
    createElement(BlockEventPage, { props: eventProps(theme) }),
  );
}

describe("BlockEventPage hero contrast", () => {
  it("keeps the hero copy legible over the photo for a light/imported theme", () => {
    const markup = render(LIGHT_THEME);
    const base = heroScrimBase(LIGHT_THEME.bg!);

    // Each theme-derived hero text element must contrast the dark photo scrim —
    // this is the regression guard: routing any of these back to the flat theme
    // palette (dark ink on a dark photo) would drop below the bar.
    expect(contrast(colorOf(markup, "HEADLINEMARKER", "h1"), base)).toBeGreaterThanOrEqual(TEXT_MIN);
    expect(contrast(colorOf(markup, "EYEBROWMARKER"), base)).toBeGreaterThanOrEqual(TEXT_MIN);
    expect(contrast(colorOf(markup, "TAGLINEMARKER"), base)).toBeGreaterThanOrEqual(TEXT_MIN);

    // The light theme's dark heading would be invisible, so it must have been
    // swapped for a light ink (i.e. not painted with the theme heading color).
    expect(colorOf(markup, "HEADLINEMARKER", "h1").toLowerCase()).not.toBe(
      LIGHT_THEME.headingColor!.toLowerCase(),
    );
  });

  it("keeps the hero copy legible for the default dark theme too", () => {
    const markup = render(undefined);
    const C = resolveTheme(undefined);
    const base = heroScrimBase(C.bg);

    expect(contrast(colorOf(markup, "HEADLINEMARKER", "h1"), base)).toBeGreaterThanOrEqual(TEXT_MIN);
    expect(contrast(colorOf(markup, "EYEBROWMARKER"), base)).toBeGreaterThanOrEqual(TEXT_MIN);
    expect(contrast(colorOf(markup, "TAGLINEMARKER"), base)).toBeGreaterThanOrEqual(TEXT_MIN);
  });

  it("leaves the default dark theme hero inks unchanged (no visual regression)", () => {
    const C = resolveTheme(undefined);
    // The default palette already clears AA on its own dark bg, so every hero
    // ink is the theme color verbatim and the scrim is built from the theme bg.
    expect(C.heroHeading).toBe(C.heading);
    expect(C.heroEyebrow).toBe(C.primary);
    expect(C.heroTagline).toBe(C.muted);
    expect(C.overlay).toContain("linear-gradient");
    // CTA label sits on the warm-gold fill; default dark bg already contrasts it.
    expect(contrast(C.heroCtaLabel, "#b59a6e")).toBeGreaterThanOrEqual(TEXT_MIN);
  });

  it("resolves a contrasting CTA label for a light theme", () => {
    const C = resolveTheme(LIGHT_THEME);
    // The fixed warm-gold CTA fill needs a dark label; the light theme bg would
    // be illegible, so it must be replaced.
    expect(contrast(C.heroCtaLabel, "#b59a6e")).toBeGreaterThanOrEqual(TEXT_MIN);
  });
});
