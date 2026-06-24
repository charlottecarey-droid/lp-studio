// @vitest-environment jsdom
/**
 * Regression guard for the white-on-white footer bug (see memory
 * "footer-paint-vs-contrast-divergence" / "footer-dandy-palette-leak").
 *
 * Root cause we are guarding against: a footer painted its background from a
 * *different* source than the one its text/logo contrast math ran against — so
 * when they diverged, or a brand CSS variable wasn't in scope on the painted
 * element (prerendered / injected HTML), the math assumed a dark surface and
 * chose white text/logo on a white surface.
 *
 * Two invariants are enforced here:
 *   1. BlockFooter paints `<footer>`'s background with the SAME resolved hex it
 *      runs its contrast math against — always a real `#rrggbb`, never a bare
 *      `var(--brand-*)` with no fallback — across a light brand, a dark brand,
 *      and an empty/missing brand-color case.
 *   2. BlockDandySiteFooter renders its logo with the light-surface contrast
 *      guard (`autoContrast`) enabled, and every brand-variable heading / link /
 *      icon carries a usable hex fallback so it stays legible when the CSS
 *      variable is absent.
 *
 * We render via `renderToStaticMarkup` (matching the other *.contrast.test.ts
 * files) because it preserves the exact inline `style` strings React emits —
 * including `var(--brand-*, #hex)` fallbacks — which jsdom's CSSOM would
 * normalize or drop. `BrandLogo` is mocked so we can assert the props each
 * footer passes it (notably `autoContrast`) without the browser-only pixel
 * sampling it performs at runtime.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Capture the props each footer hands to <BrandLogo>. The real component does
 * browser-only canvas sampling in a useEffect; for these assertions we only
 * care that the footer wires the contrast guard correctly.
 */
interface CapturedLogoProps {
  autoContrast?: boolean;
  tone?: string;
  [key: string]: unknown;
}
const brandLogoCalls: CapturedLogoProps[] = [];
vi.mock("@/components/BrandLogo", () => ({
  BrandLogo: (props: CapturedLogoProps) => {
    brandLogoCalls.push(props);
    return createElement("span", { "data-testid": "brand-logo" });
  },
  brandHasLogo: () => true,
}));

import { BlockFooter } from "./BlockFooter";
import { BlockDandySiteFooter } from "./BlockDandySiteFooter";
import {
  DEFAULT_BRAND,
  relativeLuminance,
  type BrandConfig,
} from "@/lib/brand-config";
import type { FooterBlockProps, DandySiteFooterBlockProps } from "@/lib/block-types";

const HEX6_RE = /^#[0-9a-f]{6}$/i;
/** WCAG AA for normal text. */
const TEXT_MIN = 4.5;

/**
 * Recompute WCAG contrast from the exported `relativeLuminance` so the test is
 * independent of any unexported internal helper (same approach as the other
 * contrast tests).
 */
function contrast(hexA: string, hexB: string): number {
  const a = relativeLuminance(hexA);
  const b = relativeLuminance(hexB);
  const [lo, hi] = a < b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/** Pull the `background-color` / `color` declarations off the root `<footer>`. */
function footerStyle(markup: string): { backgroundColor?: string; color?: string } {
  const m = markup.match(/<footer[^>]*style="([^"]*)"/i);
  const out: { backgroundColor?: string; color?: string } = {};
  if (!m) return out;
  for (const decl of m[1].split(";")) {
    const idx = decl.indexOf(":");
    if (idx === -1) continue;
    const prop = decl.slice(0, idx).trim();
    const value = decl.slice(idx + 1).trim();
    if (prop === "background-color") out.backgroundColor = value;
    else if (prop === "color") out.color = value;
  }
  return out;
}

/**
 * Every brand-variable *color* reference (`--brand-primary` / `--brand-accent`
 * / `--brand-on-*`) anywhere in the markup that LACKS a literal hex fallback. A
 * non-empty result means a brand color could collapse to its inherited/default
 * value when the CSS variable isn't in scope — exactly the prerender/injected-
 * HTML failure mode the bug came from. Font tokens (`--brand-font-*`) are
 * excluded: they carry their own `var()` fallback chain ending in a system
 * font, which is correct and not a contrast risk.
 */
function brandVarsMissingHexFallback(markup: string): string[] {
  const out: string[] = [];
  for (const m of markup.matchAll(/var\(\s*--brand-(?:primary|accent|on-[a-z]+)\s*(,[^)]*)?\)/gi)) {
    const fallback = m[1];
    if (!fallback || !/,\s*#[0-9a-f]{3,8}\b/i.test(fallback)) out.push(m[0]);
  }
  return out;
}

function footerProps(overrides: Partial<FooterBlockProps> = {}): FooterBlockProps {
  return {
    backgroundColor: "",
    accentColor: "",
    copyrightText: "",
    showSocialLinks: true,
    facebookUrl: "https://facebook.com/acme",
    instagramUrl: "https://instagram.com/acme",
    linkedinUrl: "https://linkedin.com/company/acme",
    columns: [
      {
        title: "Product",
        links: [
          { label: "Features", url: "#" },
          { label: "Pricing", url: "#" },
        ],
      },
    ],
    ...overrides,
  };
}

function renderFooter(brand: BrandConfig, props: FooterBlockProps): string {
  return renderToStaticMarkup(createElement(BlockFooter, { props, brand }));
}

beforeEach(() => {
  brandLogoCalls.length = 0;
});

describe("BlockFooter paint matches its contrast math", () => {
  const cases: Array<{ name: string; brand: Partial<BrandConfig>; props?: Partial<FooterBlockProps>; expectedBg: string }> = [
    {
      name: "light brand color",
      brand: { primaryColor: "#f5f5f5" },
      expectedBg: "#f5f5f5",
    },
    {
      name: "dark brand color",
      brand: { primaryColor: "#0b1f3a" },
      expectedBg: "#0b1f3a",
    },
    {
      name: "explicit light footer background overrides brand",
      brand: { primaryColor: "#0b1f3a" },
      props: { backgroundColor: "#ffffff" },
      expectedBg: "#ffffff",
    },
    {
      name: "empty / missing brand color falls back to DEFAULT_BRAND",
      brand: { primaryColor: "" },
      expectedBg: DEFAULT_BRAND.primaryColor,
    },
  ];

  for (const c of cases) {
    it(`paints a real hex and keeps text legible — ${c.name}`, () => {
      const brand: BrandConfig = { ...DEFAULT_BRAND, ...c.brand };
      const markup = renderFooter(brand, footerProps(c.props));
      const { backgroundColor, color } = footerStyle(markup);

      // The painted background is a real hex (NEVER a bare var(--brand-*)).
      expect(backgroundColor).toBeDefined();
      expect(backgroundColor).toMatch(HEX6_RE);
      expect(backgroundColor!.toLowerCase()).toBe(c.expectedBg.toLowerCase());

      // The footer text color is resolved against that SAME painted hex and
      // clears the WCAG text bar — i.e. no white-on-white / black-on-black.
      expect(color).toBeDefined();
      expect(color).toMatch(HEX6_RE);
      expect(contrast(color!, backgroundColor!)).toBeGreaterThanOrEqual(TEXT_MIN);
    });
  }

  it("never emits a brand-variable color without a hex fallback", () => {
    // A footer whose brand colors are all blank is the worst case for the
    // prerender bug: if anything paints from a bare var() it has nothing to
    // fall back to once the CSS variable is out of scope.
    const brand: BrandConfig = {
      ...DEFAULT_BRAND,
      primaryColor: "",
      accentColor: "",
    };
    const markup = renderFooter(brand, footerProps());
    expect(brandVarsMissingHexFallback(markup)).toEqual([]);
  });

  it("renders its logo with the light-surface contrast guard on a light footer", () => {
    const brand: BrandConfig = { ...DEFAULT_BRAND, primaryColor: "#f5f5f5" };
    renderFooter(brand, footerProps());
    expect(brandLogoCalls.length).toBeGreaterThanOrEqual(1);
    const logo = brandLogoCalls[0];
    expect(logo.autoContrast).toBe(true);
    // A light footer surface must request the light-surface ("onLight") logo.
    expect(logo.tone).toBe("onLight");
  });
});

function dandyFooterProps(overrides: Partial<DandySiteFooterBlockProps> = {}): DandySiteFooterBlockProps {
  return {
    disclaimer: "Some disclaimer text.",
    linkGroups: [
      {
        heading: "Company",
        links: [
          { label: "About", url: "#" },
          { label: "Careers", url: "#" },
        ],
      },
    ],
    facebookUrl: "https://facebook.com/acme",
    instagramUrl: "https://instagram.com/acme",
    linkedinUrl: "https://linkedin.com/company/acme",
    copyrightText: "",
    ...overrides,
  };
}

function renderDandyFooter(brand: BrandConfig, props: DandySiteFooterBlockProps): string {
  return renderToStaticMarkup(createElement(BlockDandySiteFooter, { props, brand }));
}

describe("BlockDandySiteFooter brand-variable legibility", () => {
  it("renders its logo with autoContrast on a light surface", () => {
    const brand: BrandConfig = { ...DEFAULT_BRAND, primaryColor: "#0b1f3a" };
    renderDandyFooter(brand, dandyFooterProps());
    expect(brandLogoCalls.length).toBeGreaterThanOrEqual(1);
    const logo = brandLogoCalls[0];
    // Removing autoContrast here is the exact regression we are guarding: a
    // white/light raster logo would vanish on the footer's near-white surface.
    expect(logo.autoContrast).toBe(true);
    expect(logo.tone).toBe("onLight");
  });

  it("gives every brand-variable heading / link / icon a usable hex fallback", () => {
    // A brand with a real primary AND one with a blank primary both have to
    // resolve a legible fallback when --brand-primary is absent from scope.
    for (const primaryColor of ["#0b1f3a", ""]) {
      const brand: BrandConfig = { ...DEFAULT_BRAND, primaryColor };
      const markup = renderDandyFooter(brand, dandyFooterProps());
      // Every var(--brand-*) reference (heading color, link hover, SVG fill)
      // carries a literal hex fallback — none collapse to inherited color.
      expect(brandVarsMissingHexFallback(markup)).toEqual([]);
      // And the fallback that IS emitted for headings is a real hex.
      const headingMatch = markup.match(/color:var\(--brand-primary,\s*(#[0-9a-f]{3,8})\)/i);
      expect(headingMatch).not.toBeNull();
      expect(headingMatch![1]).toMatch(/^#[0-9a-f]{3,8}$/i);
    }
  });
});
