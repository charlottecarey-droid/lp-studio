// @vitest-environment jsdom
/**
 * Regression guard for the invisible-header bug — the nav/header twin of the
 * white-on-white footer guard (see `Footer.contrast.test.tsx` and memory
 * "footer-paint-vs-contrast-divergence").
 *
 * Root cause we are guarding against: a header painted its background from one
 * source (an inline color / image) while its links + logo derived their color
 * from a *different* source (hard-coded Tailwind slate classes that silently
 * assume a light bar). When they diverged — e.g. a dark `backgroundColor` with
 * no explicit `textColor` — the links stayed dark-slate on a dark surface and
 * vanished "dark-on-dark", and a brand CSS variable out of scope on prerendered
 * HTML had nothing to fall back to.
 *
 * Invariants enforced here:
 *   1. BlockNavHeader paints `<header>`'s background with the SAME resolved hex
 *      it runs its link/logo contrast math against — always a real `#rrggbb`,
 *      never a bare `var(--brand-*)` — across a light header, a dark header, and
 *      an empty/missing-color (defaults to white) case.
 *   2. The link + foreground ink resolved against that painted surface clears
 *      the WCAG text bar (no invisible nav links).
 *   3. The logo is rendered with the contrast tone wired off the SAME surface
 *      (`onDark` on a dark header, `onLight` on a light one) AND the
 *      light-surface `autoContrast` guard enabled, so a white raster logo can't
 *      render white-on-white. Removing that wiring fails the test.
 *
 * We render via `renderToStaticMarkup` (matching the other *.contrast.test
 * files) because it preserves the exact inline `style` strings React emits —
 * including any `var(--brand-*, #hex)` fallbacks — which jsdom's CSSOM would
 * normalize or drop. `BrandLogo` is mocked so we can assert the props the
 * header passes it (notably `tone` + `autoContrast`) without the browser-only
 * pixel sampling it performs at runtime; the rest of the module (the real
 * `brandLogoToneForSurface`) is kept intact.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, beforeEach, vi } from "vitest";

interface CapturedLogoProps {
  autoContrast?: boolean;
  tone?: string;
  [key: string]: unknown;
}
const brandLogoCalls: CapturedLogoProps[] = [];
vi.mock("@/components/BrandLogo", async () => {
  const actual = await vi.importActual<typeof import("@/components/BrandLogo")>(
    "@/components/BrandLogo",
  );
  return {
    ...actual,
    BrandLogo: (props: CapturedLogoProps) => {
      brandLogoCalls.push(props);
      return createElement("span", { "data-testid": "brand-logo" });
    },
  };
});
// These leaf components reach for `window` at import time and are only used on
// builder/modal paths none of these renders exercise.
vi.mock("@/components/EmailCaptureModal", () => ({ EmailCaptureModal: () => null }));
vi.mock("@/components/ChiliPiperButton", () => ({
  ChiliPiperButton: ({ children }: { children?: unknown }) =>
    createElement("span", null, children as never),
}));

import { BlockNavHeader } from "./BlockNavHeader";
import {
  DEFAULT_BRAND,
  relativeLuminance,
  type BrandConfig,
} from "@/lib/brand-config";
import type { NavHeaderBlockProps } from "@/lib/block-types";

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

/** Pull the `background` / `color` declarations off the root `<header>`. */
function headerStyle(markup: string): { background?: string; color?: string } {
  const m = markup.match(/<header[^>]*style="([^"]*)"/i);
  const out: { background?: string; color?: string } = {};
  if (!m) return out;
  for (const decl of m[1].split(";")) {
    const idx = decl.indexOf(":");
    if (idx === -1) continue;
    const prop = decl.slice(0, idx).trim();
    const value = decl.slice(idx + 1).trim();
    if (prop === "background") out.background = value;
    else if (prop === "color") out.color = value;
  }
  return out;
}

/** The inline `color:` of the first nav `<a>` (a nav link). */
function firstNavLinkColor(markup: string): string | undefined {
  // The logo link (if any) carries no inline color; nav links set `color:`.
  for (const m of markup.matchAll(/<a\b[^>]*?\sstyle="([^"]*)"/gi)) {
    for (const decl of m[1].split(";")) {
      const idx = decl.indexOf(":");
      if (idx === -1) continue;
      if (decl.slice(0, idx).trim() === "color") return decl.slice(idx + 1).trim();
    }
  }
  return undefined;
}

/**
 * Every brand-variable *color* reference anywhere in the markup that LACKS a
 * literal hex fallback. A non-empty result means a brand color could collapse
 * to its inherited/default value when the CSS variable isn't in scope — exactly
 * the prerender/injected-HTML failure mode the bug came from. Font tokens
 * (`--brand-font-*`) are excluded: they carry their own fallback chain.
 */
function brandVarsMissingHexFallback(markup: string): string[] {
  const out: string[] = [];
  for (const m of markup.matchAll(/var\(\s*--brand-(?:primary|accent|on-[a-z]+)\s*(,[^)]*)?\)/gi)) {
    const fallback = m[1];
    if (!fallback || !/,\s*#[0-9a-f]{3,8}\b/i.test(fallback)) out.push(m[0]);
  }
  return out;
}

function navProps(overrides: Partial<NavHeaderBlockProps> = {}): NavHeaderBlockProps {
  return {
    logoText: "Acme",
    logoUrl: "",
    navLinks: [
      { label: "Product", url: "#" },
      { label: "Pricing", url: "#" },
    ],
    phone: "555-123-4567",
    cta1: { label: "Sign in", url: "#" },
    cta2: { label: "Get started", url: "#" },
    ...overrides,
  } as NavHeaderBlockProps;
}

function renderNav(brand: BrandConfig, props: NavHeaderBlockProps): string {
  return renderToStaticMarkup(createElement(BlockNavHeader, { props, brand }));
}

beforeEach(() => {
  brandLogoCalls.length = 0;
});

describe("BlockNavHeader paint matches its contrast math", () => {
  const cases: Array<{
    name: string;
    brand?: Partial<BrandConfig>;
    props?: Partial<NavHeaderBlockProps>;
    expectedBg: string;
    expectedTone: "onLight" | "onDark";
  }> = [
    {
      name: "light header background",
      props: { backgroundColor: "#f5f5f5" },
      expectedBg: "#f5f5f5",
      expectedTone: "onLight",
    },
    {
      name: "dark header background (the invisible-nav case)",
      props: { backgroundColor: "#0b1f3a" },
      expectedBg: "#0b1f3a",
      expectedTone: "onDark",
    },
    {
      name: "empty / missing background defaults to white",
      props: { backgroundColor: "" },
      expectedBg: "#ffffff",
      expectedTone: "onLight",
    },
  ];

  for (const c of cases) {
    it(`paints a real hex and keeps links + logo legible — ${c.name}`, () => {
      const brand: BrandConfig = { ...DEFAULT_BRAND, ...(c.brand ?? {}) };
      const markup = renderNav(brand, navProps(c.props));
      const { background, color } = headerStyle(markup);

      // The painted background is a real hex (NEVER a bare var(--brand-*)).
      expect(background).toBeDefined();
      expect(background).toMatch(HEX6_RE);
      expect(background!.toLowerCase()).toBe(c.expectedBg.toLowerCase());

      // The header foreground ink is resolved against that SAME painted hex and
      // clears the WCAG text bar — i.e. no dark-on-dark / white-on-white.
      expect(color).toBeDefined();
      expect(color).toMatch(HEX6_RE);
      expect(contrast(color!, background!)).toBeGreaterThanOrEqual(TEXT_MIN);

      // The nav links carry that same resolved ink inline (not a Tailwind
      // class that assumes a light bar), so they stay legible on the surface.
      const linkColor = firstNavLinkColor(markup);
      expect(linkColor).toBeDefined();
      expect(linkColor).toMatch(HEX6_RE);
      expect(contrast(linkColor!, background!)).toBeGreaterThanOrEqual(TEXT_MIN);

      // The logo tone is wired off the SAME surface and the light-surface guard
      // is on. Removing either is the exact regression this test guards.
      expect(brandLogoCalls.length).toBeGreaterThanOrEqual(1);
      const logo = brandLogoCalls[0];
      expect(logo.tone).toBe(c.expectedTone);
      expect(logo.autoContrast).toBe(true);
    });
  }

  it("never emits a brand-variable color without a hex fallback", () => {
    // A nav whose brand colors are all blank is the worst case for the
    // prerender bug: if anything paints from a bare var() it has nothing to
    // fall back to once the CSS variable is out of scope.
    const brand: BrandConfig = {
      ...DEFAULT_BRAND,
      primaryColor: "",
      accentColor: "",
    };
    const markup = renderNav(brand, navProps());
    expect(brandVarsMissingHexFallback(markup)).toEqual([]);
  });

  it("treats a background image as a dark surface and whitens the logo tone", () => {
    // A header background image sits behind a dark overlay; the logo + ink must
    // resolve for a dark surface so they read over the imagery.
    const brand: BrandConfig = { ...DEFAULT_BRAND };
    const markup = renderNav(
      brand,
      navProps({ backgroundImage: "https://cdn.example.com/bar.jpg", backgroundOverlay: 0.4 }),
    );
    const { color } = headerStyle(markup);
    expect(color).toBe("#ffffff");
    expect(brandLogoCalls[0]?.tone).toBe("onDark");
    expect(brandLogoCalls[0]?.autoContrast).toBe(true);
  });
});
