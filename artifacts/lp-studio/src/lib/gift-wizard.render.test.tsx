import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { StaticRenderContext } from "@/lib/reveal-fallback";
import { DEFAULT_BRAND } from "@/lib/brand-config";
import { BlockGiftHero } from "@/blocks/BlockGiftHero";
import { BlockGiftPicker } from "@/blocks/BlockGiftPicker";
import { buildGiftProps } from "./gift-wizard";
import { resolvePreviewTokens } from "@/components/sales/GiftPagePreview";

const source = { "gift-hero": { headline: "Pick the gift", kicker: "Happy holidays from Dandy", heroImageUrl: "/img/x.webp", logoUrl: "/dandy-logo-white.svg", ctaText: "See the options", tagFrom: "From your Dandy team" } };

describe("gift preview props", () => {
  it("renders the hero for both layouts, with no raw tokens, and envelope off", () => {
    for (const layout of ["classic", "atelier"] as const) {
      const hero = buildGiftProps(source, { tier: "premium", audience: "customer", layout, envelope: true })["gift-hero"];
      const props = resolvePreviewTokens({ ...hero, envelopeIntro: false });
      expect(JSON.stringify(props)).not.toContain("{{");
      const html = renderToStaticMarkup(createElement(StaticRenderContext.Provider, { value: true }, createElement(BlockGiftHero as never, { props, brand: DEFAULT_BRAND })));
      expect(html).toContain("Pick the gift");
    }
  });
  it("turns {{x|fallback}} into the fallback", () => {
    expect(resolvePreviewTokens({ a: "To {{first_name|you}}", b: "{{rep_name}}" })).toEqual({ a: "To you", b: "" });
  });
});

describe("single-gift picker", () => {
  it("is a featured gift in both layouts: claim button, no 'choose one' framing", () => {
    for (const layout of ["classic", "atelier"] as const) {
      const props = { layout, kicker: "Your gift", headline: "A gift,\njust for you.", subheadline: "It ships straight to you.", chooseText: "Claim this gift", options: [{ name: "Yeti Mug and Wireless Charger Duo", caption: "c" }] };
      const html = renderToStaticMarkup(createElement(StaticRenderContext.Provider, { value: true }, createElement(BlockGiftPicker as never, { props, brand: DEFAULT_BRAND })));
      expect(html).toContain("Claim this gift");
      expect(html.toLowerCase()).not.toContain("choose one");
      expect(html).not.toContain("Choose this one");
      expect(html).not.toContain("No. 01");
    }
  });
  it("still offers a choice when there are several", () => {
    const props = { layout: "atelier" as const, headline: "h", options: [{ name: "A" }, { name: "B" }] };
    const html = renderToStaticMarkup(createElement(StaticRenderContext.Provider, { value: true }, createElement(BlockGiftPicker as never, { props, brand: DEFAULT_BRAND })));
    expect(html).toContain("Choose this one");
    expect(html.toLowerCase()).toContain("choose one");
  });
});
