import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";

/**
 * SSR smoke + contract test for the Holiday Gift block family (Nov 2026):
 * the "pick your gift" page a rep sends a prospect (gift-hero, gift-picker,
 * gift-form, gift-note).
 *
 * Pins: every block renders its default copy under the neutral DEFAULT_BRAND
 * on a DARK surface derived from the brand primary; registry defaults leak no
 * Dandy strings; blocks without images never emit a broken `<img src="">` and
 * never hide content at opacity 0; the hero renders its own sticky top bar,
 * the gift tag and the ribbon; the picker renders one "choose" button per
 * gift; the form renders step one with the picker's registered names (or its
 * own), a three-segment progress bar, and never a submit button before step
 * three; the selection store round-trips choice + deep links.
 */
import { StaticRenderContext } from "@/lib/reveal-fallback";
import { DEFAULT_BRAND } from "@/lib/brand-config";
import { relativeLuminance } from "@/lib/brand-config";
import { BLOCK_REGISTRY } from "@/lib/block-types";
import { NO_REVEAL } from "./BlockRenderer";
import { resolveGiftPalette } from "./gift/gift-theme";
import { getGiftSelection, readGiftFromSearch, registerGiftOptions, resetGiftSelection, selectGift } from "./gift/gift-selection";
import { BlockGiftHero } from "./BlockGiftHero";
import { BlockGiftPicker } from "./BlockGiftPicker";
import { BlockGiftForm } from "./BlockGiftForm";
import { BlockGiftNote } from "./BlockGiftNote";

const FAMILY = [
  ["gift-hero", BlockGiftHero],
  ["gift-picker", BlockGiftPicker],
  ["gift-form", BlockGiftForm],
  ["gift-note", BlockGiftNote],
] as const;

function defaultsFor(type: string): Record<string, unknown> {
  const def = BLOCK_REGISTRY.find((d) => d.type === type);
  if (!def) throw new Error(`missing registry entry: ${type}`);
  return def.defaultProps() as Record<string, unknown>;
}

function render(Component: (p: never) => ReactElement, props: Record<string, unknown>, staticRender = false): string {
  const el = createElement(Component as never, { props, brand: DEFAULT_BRAND } as never);
  return renderToStaticMarkup(staticRender ? createElement(StaticRenderContext.Provider, { value: true }, el) : el);
}

const DANDY_LEAK = /meetdandy|#003a30|#00231d|#c7e738|\bDandy\b|AirPods|Ray-Ban|Meta Quest|Lab Tour/i;

beforeEach(() => resetGiftSelection());

describe("Gift family — registry defaults render on the neutral brand", () => {
  it.each(FAMILY)("%s renders its default headline, on a dark surface, with no Dandy / campaign leak", (type, Component) => {
    const props = defaultsFor(type);
    const html = render(Component as never, props, true);
    const headline = ((props.headline as string) ?? "").split("\n")[0];
    expect(headline.length).toBeGreaterThan(0);
    expect(html).toContain(headline.split("'")[0].slice(0, 10));
    expect(html).not.toMatch(DANDY_LEAK);
    expect(html).toMatch(/<section[^>]*style="[^"]*background:#0/);
    expect(html).not.toMatch(/opacity:\s*0[;"]/);
    expect(html).not.toMatch(/<img[^>]*src=""/);
  });

  it("derives the dark Invite palette plus the fixed cream/gold wrapping", () => {
    const pal = resolveGiftPalette({}, DEFAULT_BRAND);
    expect(relativeLuminance(pal.bg)).toBeLessThan(0.08);
    expect(pal.cream).toBe("#FBF7EE");
    expect(pal.gold).toBe("#E8CC8A");
  });

  it("every gift block is registered, tagged, and in the renderer's NO_REVEAL set", () => {
    for (const [type] of FAMILY) {
      const def = BLOCK_REGISTRY.find((d) => d.type === type);
      expect(def, type).toBeTruthy();
      expect(def?.tags?.length ?? 0, `${type} tags`).toBeGreaterThan(0);
      expect(NO_REVEAL.has(type), `${type} NO_REVEAL`).toBe(true);
    }
  });
});

describe("gift-hero — top bar, tag, ribbon, snow", () => {
  it("renders the sticky top bar, the jump CTA pair, the gift tag and the ribbon; static render skips the snow layer", () => {
    const html = render(BlockGiftHero as never, defaultsFor("gift-hero"), true);
    expect(html).toMatch(/class="sticky top-0/);
    expect(html).toContain('href="#gifts"');
    expect(html).toContain('href="#redeem"');
    expect(html).toContain('data-gift-tag="true"');
    expect(html).toContain("To you");
    expect(html).toContain('data-gift-ribbon="true"');
    expect(html).not.toContain("data-gift-snow");
    expect(html).not.toMatch(/<img/);
  });

  it("renders the snow layer on the live page, sized by `snow`, and drops it at 0", () => {
    const live = render(BlockGiftHero as never, { ...defaultsFor("gift-hero"), snow: 12 });
    expect(live).toContain('data-gift-snow="12"');
    expect(live.match(/class="gift-flake"/g)).toHaveLength(12);
    const none = render(BlockGiftHero as never, { ...defaultsFor("gift-hero"), snow: 0 });
    expect(none).not.toContain("data-gift-snow");
  });

  it("hides the tag when both lines are blank and the ribbon when switched off", () => {
    const html = render(BlockGiftHero as never, { ...defaultsFor("gift-hero"), tagTo: "", tagFrom: "", showRibbon: false }, true);
    expect(html).not.toContain("data-gift-tag");
    expect(html).not.toContain("data-gift-ribbon");
  });
});

describe("gift-picker — one card per gift", () => {
  it("renders a numbered ribbon, the name and a choose button for each gift, none picked by default", () => {
    const html = render(BlockGiftPicker as never, defaultsFor("gift-picker"), true);
    expect(html.match(/data-gift-option=/g)).toHaveLength(3);
    expect(html.match(/data-gift-picked="false"/g)).toHaveLength(3);
    expect(html.match(/Choose this one/g)).toHaveLength(3);
    expect(html).toContain(">01<");
    expect(html).toContain("Gift three");
  });

  it("uses a badge label on the ribbon when set", () => {
    const d = defaultsFor("gift-picker") as { options: Array<Record<string, unknown>> };
    const html = render(BlockGiftPicker as never, { ...d, options: [{ ...d.options[0], badge: "Most popular" }, d.options[1]] }, true);
    expect(html).toContain("Most popular");
    expect(html).not.toContain(">01<");
  });
});

describe("gift-form — three steps on a cream card", () => {
  it("renders step one with the block's own gift names, a 3-segment ribbon and Next (never Submit) on step one", () => {
    const html = render(BlockGiftForm as never, { ...defaultsFor("gift-form"), options: ["Alpha", "Beta"] }, true);
    expect(html).toContain('data-gift-step="1"');
    expect(html).toContain("Step 1 of 3");
    expect(html.match(/data-gift-choice=/g)).toHaveLength(2);
    expect(html).toContain("Alpha");
    expect(html).not.toContain("Send my gift");
    expect(html).toContain("Next");
    expect(html).not.toContain('type="submit"');
  });

  it("falls back to the names the picker registered when the form lists none", () => {
    registerGiftOptions(["From picker A", "From picker B", "From picker C"]);
    const html = render(BlockGiftForm as never, defaultsFor("gift-form"));
    expect(html.match(/data-gift-choice=/g)).toHaveLength(3);
    expect(html).toContain("From picker C");
  });

  it("explains itself when no gifts are known yet", () => {
    const html = render(BlockGiftForm as never, defaultsFor("gift-form"), true);
    expect(html).toContain("Add a gift picker above this form");
  });

  it("asks for a size only when sizes are listed", () => {
    const none = render(BlockGiftForm as never, { ...defaultsFor("gift-form"), options: ["A"] }, true);
    expect(none).not.toContain('id="gift-size"');
    const sized = render(BlockGiftForm as never, { ...defaultsFor("gift-form"), options: ["A"], sizeLabel: "Size", sizeOptions: ["S", "M", "L"] }, true);
    expect(sized).toContain('id="gift-size"');
    expect(sized).toContain(">M<");
  });
});

describe("gift-note — the holiday card", () => {
  it("renders the card with the ornament, note and signature, and no link when none is set", () => {
    const html = render(BlockGiftNote as never, defaultsFor("gift-note"), true);
    expect(html).toContain("Thank you for a great year.");
    expect(html).toContain("With thanks,");
    expect(html).toContain("The team");
    expect(html).not.toMatch(/<a /);
  });

  it("renders the link under the card when text and URL are set", () => {
    const html = render(BlockGiftNote as never, { ...defaultsFor("gift-note"), linkText: "See more from us", linkUrl: "https://example.com/new" }, true);
    expect(html).toMatch(/<a [^>]*href="https:\/\/example\.com\/new"/);
    expect(html).toContain("See more from us");
  });
});

describe("gift selection store", () => {
  it("registers options, records a choice, and ignores no-op writes", () => {
    registerGiftOptions([" A ", "", "B"]);
    expect(getGiftSelection().options).toEqual(["A", "B"]);
    selectGift("B");
    expect(getGiftSelection().selected).toBe("B");
    const before = getGiftSelection();
    registerGiftOptions(["A", "B"]);
    expect(getGiftSelection()).toBe(before);
  });

  it("reads a ?gift= deep link case-insensitively and only when it names a known gift", () => {
    expect(readGiftFromSearch("?gift=lab%20box", ["Lab Box", "Headphones"])).toBe("Lab Box");
    expect(readGiftFromSearch("?utm_content=rep&gift=Headphones", ["Lab Box", "Headphones"])).toBe("Headphones");
    expect(readGiftFromSearch("?gift=Nope", ["Lab Box"])).toBe("");
    expect(readGiftFromSearch("", ["Lab Box"])).toBe("");
  });
});
