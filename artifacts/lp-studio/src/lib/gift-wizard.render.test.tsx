import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { StaticRenderContext } from "@/lib/reveal-fallback";
import { DEFAULT_BRAND } from "@/lib/brand-config";
import { BlockGiftHero } from "@/blocks/BlockGiftHero";
import { BlockGiftPicker } from "@/blocks/BlockGiftPicker";
import { resetGiftSelection, setSoldOut, selectGift } from "@/blocks/gift/gift-selection";
import { buildGiftProps } from "./gift-wizard";
import { resolvePreviewTokens } from "@/components/sales/GiftPagePreview";
import { adaptHeroCopy } from "@/lib/gift-copy";

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

describe("sold-out gifts", () => {
  const three = (layout: "classic" | "atelier", extra: Record<string, unknown> = {}) => ({ layout, headline: "Three gifts.\nOne is yours.", options: [{ name: "Branded AirPods kit" }, { name: "Dandy Meta Ray-Bans" }, { name: "Yeti Mug" }], ...extra });
  const render = (el: unknown) => renderToStaticMarkup(createElement(StaticRenderContext.Provider, { value: true }, el as never));
  const picker = (layout: "classic" | "atelier", extra?: Record<string, unknown>) => render(createElement(BlockGiftPicker as never, { props: three(layout, extra), brand: DEFAULT_BRAND }));

  it("hides sold-out gifts on the live page in both layouts and keeps the rest choosable", () => {
    resetGiftSelection();
    selectGift("Branded AirPods kit");
    setSoldOut(["branded airpods kit"]);
    for (const layout of ["classic", "atelier"] as const) {
      const out = picker(layout);
      expect(out).not.toContain("Branded AirPods kit");
      expect(out).toContain("Dandy Meta Ray-Bans");
      expect(out).toContain("Yeti Mug");
      expect(out).toContain("Choose this one");
      expect(out).not.toContain("Sold out");
    }
    resetGiftSelection();
  });
  it("turns into a featured gift when only one is left, with no 'choose one' wording", () => {
    resetGiftSelection();
    setSoldOut(["branded airpods kit", "dandy meta ray-bans"]);
    for (const layout of ["classic", "atelier"] as const) {
      const out = picker(layout);
      expect(out).toContain("Yeti Mug");
      expect(out).toContain("Claim this gift");
      expect(out).toContain("A gift,");
      expect(out).not.toContain("One is yours");
      expect(out.toLowerCase()).not.toContain("choose one");
    }
    resetGiftSelection();
  });
  it("says so when every gift is gone", () => {
    resetGiftSelection();
    setSoldOut(["branded airpods kit", "dandy meta ray-bans", "yeti mug"]);
    expect(picker("atelier")).toContain("Every gift has been claimed");
    resetGiftSelection();
  });
  it("shows the limited-quantities note by default, and hides it when blanked", () => {
    resetGiftSelection();
    for (const layout of ["classic", "atelier"] as const) {
      expect(picker(layout)).toContain("Quantities are limited");
      expect(picker(layout, { limitedNote: "" })).not.toContain("Quantities are limited");
      expect(picker(layout, { limitedNote: "Only 40 left." })).toContain("Only 40 left.");
    }
  });
});

describe("hero copy when gifts are hidden", () => {
  it("adapts counts, and features the last gift", () => {
    const props = { headline: "Pick the gift that suits you", subheadline: "Choose one of three, tell us where.", ctaText: "See the three gifts" };
    const two = adaptHeroCopy(props, 2);
    expect(two.subheadline).toBe("Choose one of two, tell us where.");
    expect(two.ctaText).toBe("See the two gifts");
    expect(two.headline).toBe("Pick the gift that suits you");
    expect(adaptHeroCopy(props, 1).headline).toBe("A gift,\nfrom us to you.");
  });
});
