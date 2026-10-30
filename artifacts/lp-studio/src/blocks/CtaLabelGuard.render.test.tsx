import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

/**
 * Oct 2026 — the generator's dead-link pass clears a CTA's label and URL when
 * it has no destination ("button hidden"). full-bleed-hero and
 * aurora-cta-finale still drew an arrow-only pill, so an HVAC page shipped two
 * label-less buttons. Contract: on the live page, no label → no primary button;
 * in the editor the button stays so the label can be typed back.
 */
import { StaticRenderContext } from "@/lib/reveal-fallback";
import { DEFAULT_BRAND } from "@/lib/brand-config";
import { BLOCK_REGISTRY } from "@/lib/block-types";
import { BlockFullBleedHero } from "./BlockFullBleedHero";
import { BlockAuroraCtaFinale } from "./BlockAuroraCtaFinale";

function defaults(type: string): Record<string, unknown> {
  const def = BLOCK_REGISTRY.find((d) => d.type === type);
  if (!def) throw new Error(`missing registry entry: ${type}`);
  return def.defaultProps() as Record<string, unknown>;
}

function render(Component: unknown, props: Record<string, unknown>, onFieldChange?: () => void): string {
  const el = createElement(Component as never, { props, brand: DEFAULT_BRAND, onFieldChange } as never);
  return renderToStaticMarkup(createElement(StaticRenderContext.Provider, { value: true }, el));
}

describe.each([
  ["full-bleed-hero", BlockFullBleedHero, "data-lucide"],
  ["aurora-cta-finale", BlockAuroraCtaFinale, "data-lucide"],
] as const)("%s — primary CTA with no label", (type, Component) => {
  it("live page: renders no primary button when ctaText is empty", () => {
    // backgroundType "image": the default video background renders an
    // Unmute control, which is a button but not a CTA.
    const props = { ...defaults(type), ctaText: "", ctaUrl: "", ctaSecondaryText: "", secondaryCtaText: "", backgroundType: "image" };
    const html = render(Component, props);
    expect(html).not.toMatch(/<button/);
  });

  it("live page: renders the button when a label exists", () => {
    const props = { ...defaults(type), ctaText: "Book a tune-up", ctaUrl: "https://example.com/book" };
    const html = render(Component, props);
    expect(html).toContain("Book a tune-up");
  });

  it("editor: keeps the button so the label can be edited back", () => {
    const props = { ...defaults(type), ctaText: "", ctaUrl: "", backgroundType: "image" };
    const html = render(Component, props, () => {});
    expect(html).toMatch(/<button/);
  });
});
