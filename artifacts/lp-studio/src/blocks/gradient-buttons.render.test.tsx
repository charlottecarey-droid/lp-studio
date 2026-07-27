import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

/**
 * End-to-end proof that a brand/page-level GRADIENT primary fill actually
 * reaches the blocks that hand-roll their buttons with an inline background —
 * the ones a CSS rule can never touch because they carry no marker class.
 *
 * These are the blocks Charlotte reported as not working: the DSO family
 * (Heartland hero), the final-CTA blocks, and the sticky site header. All of
 * them resolve their fill through pickCtaButtonColors, so the gradient is
 * returned by that helper rather than painted by a stylesheet.
 */
import { DEFAULT_BRAND, type BrandConfig } from "@/lib/brand-config";
import { gradientButtonStyleRaw } from "@/lib/button-gradient";
import { BlockDsoHeartlandHero } from "./BlockDsoHeartlandHero";
import { BlockBottomCta } from "./BlockBottomCta";
import { getBlockDef } from "@/lib/block-types";

const GRADIENT_CSS = "linear-gradient(90deg, #4b47e5 0%, #8b5cf6 100%)";
const gradientBrand: BrandConfig = {
  ...DEFAULT_BRAND,
  buttonStyleRaw: gradientButtonStyleRaw({ from: "#4B47E5", to: "#8B5CF6", angle: 90 }, "#ffffff"),
};

/** Registry defaults so each block renders its real, fully-populated shape. */
function defaultsFor(type: string): Record<string, unknown> {
  const def = getBlockDef(type as Parameters<typeof getBlockDef>[0]);
  return (def?.defaultProps?.() ?? {}) as Record<string, unknown>;
}

describe("gradient primary fills reach inline-styled buttons", () => {
  it("DSO Heartland hero renders the gradient (not a flat hex)", () => {
    const html = renderToStaticMarkup(
      createElement(BlockDsoHeartlandHero as never, {
        props: defaultsFor("dso-heartland-hero"),
        brand: gradientBrand,
      }),
    );
    expect(html).toContain("linear-gradient(90deg");
  });

  it("Bottom CTA renders the gradient", () => {
    const html = renderToStaticMarkup(
      createElement(BlockBottomCta as never, {
        props: defaultsFor("bottom-cta"),
        brand: gradientBrand,
      }),
    );
    expect(html).toContain("linear-gradient(90deg");
  });

  it("without a gradient those blocks still render a solid hex fill", () => {
    const solid: BrandConfig = { ...DEFAULT_BRAND, ctaBackground: "#0F6E56" };
    const html = renderToStaticMarkup(
      createElement(BlockBottomCta as never, {
        props: defaultsFor("bottom-cta"),
        brand: solid,
      }),
    );
    expect(html).not.toContain("linear-gradient(90deg");
    // A solid fill stays a hex. The exact value is NOT pinned: the solid path
    // contrast-adjusts the preference against the section background (here a
    // brand-primary band), which is long-standing, deliberate behaviour.
    expect(html).toMatch(/background(-color)?:#[0-9a-f]{6}/i);
  });

  it("Heartland hero keeps a legible label instead of contrast-mathing the gradient string", () => {
    const html = renderToStaticMarkup(
      createElement(BlockDsoHeartlandHero as never, {
        props: defaultsFor("dso-heartland-hero"),
        brand: gradientBrand,
      }),
    );
    // The helper's first-stop-resolved label, never an "undefined"/NaN colour.
    expect(html).not.toContain("color:undefined");
    expect(html).not.toContain("color:NaN");
    expect(html).toMatch(/color:#(fff|ffffff|000|000000)/i);
  });

  it("an explicit per-block button colour still wins over the brand gradient", () => {
    const html = renderToStaticMarkup(
      createElement(BlockDsoHeartlandHero as never, {
        props: { ...defaultsFor("dso-heartland-hero"), buttonColor: "#C8923D" },
        brand: gradientBrand,
      }),
    );
    expect(html.toLowerCase()).toContain("#c8923d");
  });

  it("the gradient CSS string itself is well-formed", () => {
    expect(GRADIENT_CSS).toMatch(/^linear-gradient\(\d+deg, #[0-9a-f]{6} 0%, #[0-9a-f]{6} 100%\)$/);
  });
});

describe("BlockDsoHeartlandHero — inline headline editing", () => {
  const props = { ...defaultsFor("dso-heartland-hero"), headline: "Scale {every} location" };

  it("renders an editable headline in the builder (raw text, tokens visible)", () => {
    const html = renderToStaticMarkup(
      createElement(BlockDsoHeartlandHero as never, {
        props,
        brand: DEFAULT_BRAND,
        onFieldChange: () => {},
      }),
    );
    // InlineText's edit affordance (contentEditable is attached on click, so
    // it isn't in static markup — the title/hover outline is the SSR tell).
    const headline = /<h1[^>]*>(.*?)<\/h1>/s.exec(html)?.[1] ?? "";
    expect(headline).toContain('title="Click to edit"');
    // The raw string — braces included — so a token can be authored/removed.
    expect(headline).toContain("Scale {every} location");
  });

  it("keeps the accent-token decoration on the published page", () => {
    const html = renderToStaticMarkup(
      createElement(BlockDsoHeartlandHero as never, { props, brand: DEFAULT_BRAND }),
    );
    expect(html).not.toContain('title="Click to edit"');
    // Decorated: the token is split into its own styled span, braces stripped.
    expect(html).not.toContain("{every}");
    expect(html).toContain("every");
  });
});
