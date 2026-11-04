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
import { resetGiftNoteStore, setEnvelopeActive } from "./gift/note-store";
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

beforeEach(() => { resetGiftSelection(); resetGiftNoteStore(); });

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

describe("Atelier layout — light luxury variant of every gift block", () => {
  it.each(FAMILY)("%s defaults to Classic and switches to Atelier on a light surface with no leak or empty image", (type, Component) => {
    const props = defaultsFor(type);
    expect(props.layout).toBe("classic");
    const html = render(Component as never, { ...props, layout: "atelier" }, true);
    expect(html).toContain('data-gift-layout="atelier"');
    expect(html).toMatch(/<section[^>]*style="[^"]*background:#(EFE5DA|FBF8F3)/i);
    expect(html).not.toMatch(DANDY_LEAK);
    expect(html).not.toMatch(/<img[^>]*src=""/);
    expect(html).not.toMatch(/opacity:\s*0[;"]/);
  });

  it("hero: announcement strip, wordmark bar, gift-box art without a photo, photo + satin ribbon with one", () => {
    const base = { ...defaultsFor("gift-hero"), layout: "atelier" };
    const boxes = render(BlockGiftHero as never, base, true);
    expect(boxes).toContain("Complimentary delivery");
    expect(boxes).toContain('data-atl-boxes="stack"');
    expect(boxes).toContain('data-atl-tag="true"');
    expect(boxes).not.toContain("data-atl-ribbon");
    const photo = render(BlockGiftHero as never, { ...base, heroImageUrl: "/images/x.webp" }, true);
    expect(photo).toMatch(/<img[^>]*src="\/images\/x\.webp"/);
    expect(photo).toContain('data-atl-ribbon="vertical"');
    expect(photo).toContain('data-atl-bow="true"');
    const forced = render(BlockGiftHero as never, { ...base, heroImageUrl: "/images/x.webp", heroArt: "boxes" }, true);
    expect(forced).not.toMatch(/<img[^>]*src="\/images\/x\.webp"/);
  });

  it("picker: numbered serif tiles, a ribboned box where a photo is missing, the ribbon only on the chosen gift", () => {
    const d = defaultsFor("gift-picker");
    registerGiftOptions(["Gift one", "Gift two", "Gift three"]);
    selectGift("Gift two");
    const html = render(BlockGiftPicker as never, { ...d, layout: "atelier" });
    expect(html.match(/data-atl-boxes="single"/g)).toHaveLength(3);
    expect(html).toContain("No. 01");
    expect(html.match(/data-gift-picked="true"/g)).toHaveLength(1);
    expect(html.match(/data-atl-ribbon=/g)).toHaveLength(1);
    expect(html).toContain("selection");
  });

  it("form: selection summary with the chosen gift and summary lines, numbered step tabs, Continue (no submit) on step one", () => {
    registerGiftOptions(["Alpha", "Beta"], { Alpha: { imageUrl: "/images/alpha.webp", caption: "The alpha one." } });
    selectGift("Alpha");
    const html = render(BlockGiftForm as never, { ...defaultsFor("gift-form"), layout: "atelier" });
    expect(html).toContain("Your selection");
    expect(html).toContain('data-atl-summary="Alpha"');
    expect(html).toMatch(/<img[^>]*src="\/images\/alpha\.webp"/);
    expect(html).toContain("The alpha one.");
    expect(html).toContain("Complimentary");
    expect(html).toContain('aria-current="step"');
    expect(html.match(/data-gift-choice=/g)).toHaveLength(2);
    expect(html).toContain("Continue");
    expect(html).not.toContain('type="submit"');
  });

  it("note: a ribbon-tied letter with bow, tag and serif signature", () => {
    const html = render(BlockGiftNote as never, { ...defaultsFor("gift-note"), layout: "atelier" }, true);
    expect(html).toContain('data-atl-ribbon="vertical"');
    expect(html).toContain('data-atl-bow="true"');
    expect(html).toContain("The team");
  });

  it("the store keeps photo + caption per gift and drops details for names no longer listed", () => {
    registerGiftOptions(["A", "B"], { A: { imageUrl: "/a.webp" }, B: { caption: "bee" }, C: { caption: "gone" } });
    expect(getGiftSelection().details).toEqual({ A: { imageUrl: "/a.webp" }, B: { caption: "bee" } });
  });
});

describe("gift-note — greeting, rep line and calendar link (both layouts)", () => {
  it.each(["classic", "atelier"])("%s: hides greeting, rep line and calendar on the live page by default", (layout) => {
    const html = render(BlockGiftNote as never, { ...defaultsFor("gift-note"), layout }, true);
    expect(html).not.toContain("data-gift-greeting");
    expect(html).not.toContain("data-gift-rep");
    expect(html).not.toContain("data-gift-calendar");
  });

  it.each(["classic", "atelier"])("%s: renders the greeting, rep role + headshot and a new-tab calendar link when set", (layout) => {
    const html = render(BlockGiftNote as never, {
      ...defaultsFor("gift-note"),
      layout,
      greeting: "Hi Gilberto,",
      signature: "Dan MacAdam",
      repTitle: "Strat AE",
      repPhotoUrl: "/images/dan.webp",
      calendarUrl: "https://example.chilipiper.com/me/dan",
      calendarText: "Grab time with Dan",
    }, true);
    expect(html).toContain("Hi Gilberto,");
    expect(html).toContain("Dan MacAdam");
    expect(html).toContain("Strat AE");
    expect(html).toMatch(/<img[^>]*src="\/images\/dan\.webp"/);
    expect(html).toMatch(/<a[^>]*href="https:\/\/example\.chilipiper\.com\/me\/dan"[^>]*target="_blank"/);
    expect(html).toContain("Grab time with Dan");
  });

  it("keeps paragraph breaks in the note body", () => {
    const html = render(BlockGiftNote as never, { ...defaultsFor("gift-note"), body: "One.\n\nTwo." }, true);
    expect(html).toMatch(/whitespace-pre-line[^>]*>/);
  });
});

describe("gift-picker — optional second image on hover / tap (both layouts)", () => {
  const withBack = (layout: string) => {
    const d = defaultsFor("gift-picker") as { options: Array<Record<string, unknown>> };
    return { ...d, layout, options: [{ ...d.options[0], imageUrl: "/img/front.webp", hoverImageUrl: "/img/back.webp", hoverImageAlt: "Back of the shirt" }, d.options[1], d.options[2]] };
  };

  it.each(["classic", "atelier"])("%s: only gifts with a second image get the flip, its back view and the two dots", (layout) => {
    const html = render(BlockGiftPicker as never, withBack(layout), true);
    expect(html.match(/data-gift-flip="front"/g)).toHaveLength(1);
    expect(html.match(/data-gift-back="true"/g)).toHaveLength(1);
    expect(html).toMatch(/<img[^>]*src="\/img\/back\.webp"[^>]*alt="Back of the shirt"|<img[^>]*alt="Back of the shirt"[^>]*src="\/img\/back\.webp"/);
    expect(html).toContain('role="button"');
    expect(html).toContain("gift-flip-dot-b");
  });

  it.each(["classic", "atelier"])("%s: the builder shows only the editable front view", (layout) => {
    const el = createElement(BlockGiftPicker as never, { props: withBack(layout), brand: DEFAULT_BRAND, onFieldChange: () => {} } as never);
    const html = renderToStaticMarkup(createElement(StaticRenderContext.Provider, { value: true }, el));
    expect(html).not.toContain("data-gift-flip");
    expect(html).not.toContain("/img/back.webp");
  });
});


describe("gift-hero — optional envelope intro", () => {
  it("is off by default (the page opens on the hero as before)", () => {
    expect(defaultsFor("gift-hero").envelopeIntro).toBe(false);
    const html = render(BlockGiftHero as never, defaultsFor("gift-hero"), true);
    expect(html).not.toContain("data-gift-envelope");
  });

  it.each(["classic", "atelier"])("%s: live page opens on a sealed envelope with the address line and an Open card button", (layout) => {
    const html = render(BlockGiftHero as never, { ...defaultsFor("gift-hero"), layout, envelopeIntro: true, envelopeTo: "For Gilberto", openCardText: "Open card" }, true);
    expect(html).toContain('data-gift-envelope="closed"');
    expect(html).toContain("For Gilberto");
    expect(html).toContain('data-gift-open-card="true"');
    expect(html).toContain("Open card");
    expect(html).toContain("Happy holidays");
    expect(html).not.toContain('data-gift-card="true"');
  });

  it("builder shows the normal hero with a notice instead of the envelope", () => {
    const el = createElement(BlockGiftHero as never, { props: { ...defaultsFor("gift-hero"), envelopeIntro: true }, brand: DEFAULT_BRAND, onFieldChange: () => {} } as never);
    const html = renderToStaticMarkup(createElement(StaticRenderContext.Provider, { value: true }, el));
    expect(html).toContain('data-gift-envelope-notice="true"');
    expect(html).not.toContain('data-gift-envelope="closed"');
    expect(html).toMatch(/class="sticky top-0/);
  });

  it("the note hides on the live page while an envelope shows it, but stays editable in the builder", () => {
    setEnvelopeActive(true);
    expect(render(BlockGiftNote as never, defaultsFor("gift-note"), true)).toBe("");
    const el = createElement(BlockGiftNote as never, { props: defaultsFor("gift-note"), brand: DEFAULT_BRAND, onFieldChange: () => {} } as never);
    expect(renderToStaticMarkup(createElement(StaticRenderContext.Provider, { value: true }, el))).toContain("Thank you for a great year.");
    setEnvelopeActive(false);
    expect(render(BlockGiftNote as never, defaultsFor("gift-note"), true)).toContain("Thank you for a great year.");
  });
});

describe("bulk-page personalization — personal note and form pre-fill", () => {
  it.each(["classic", "atelier"])("%s: a rep's own note replaces the template note; blank or unresolved keeps it", (layout) => {
    const base = { ...defaultsFor("gift-note"), layout, body: "Working with you this year has been a highlight." };
    const withNote = render(BlockGiftNote as never, { ...base, personalNote: "Great seeing you in Austin!" }, true);
    expect(withNote).toContain('data-gift-personal-note="true"');
    expect(withNote).toContain("Great seeing you in Austin!");
    expect(withNote).not.toContain("has been a highlight");
    for (const personalNote of ["", "  ", "{{personal_note}}"]) {
      const kept = render(BlockGiftNote as never, { ...base, personalNote }, true);
      expect(kept).not.toContain("data-gift-personal-note");
      expect(kept).toContain("has been a highlight");
    }
    // The builder shows both, so the template copy stays editable.
    const editor = renderToStaticMarkup(createElement(BlockGiftNote as never, { props: { ...base, personalNote: "Great seeing you in Austin!" }, brand: DEFAULT_BRAND, onFieldChange: () => {} } as never));
    expect(editor).toContain("has been a highlight");
    expect(editor).toContain("Great seeing you in Austin!");
  });

  it("pre-fill ignores blanks and unresolved {{tokens}} (the builder) and keeps real values", async () => {
    const { prefillValues, cleanPrefill } = await import("./gift/use-gift-form");
    expect(prefillValues({ prefillFirstName: "Gilberto", prefillLastName: "{{last_name}}", prefillEmail: " g@apex.com ", prefillCompany: "" })).toEqual({ firstName: "Gilberto", email: "g@apex.com" });
    expect(cleanPrefill("{{rep_name}}")).toBe("");
    expect(cleanPrefill("Dan MacAdam")).toBe("Dan MacAdam");
  });
});

describe("gift-picker — the photo itself selects the gift", () => {
  it.each(["classic", "atelier"])("%s: every live tile is a labelled button; the builder tile is not", (layout) => {
    const live = render(BlockGiftPicker as never, { ...defaultsFor("gift-picker"), layout }, true);
    expect(live.match(/data-gift-select="true"/g)).toHaveLength(3);
    expect(live).toContain('aria-label="Choose Gift one"');
    const el = createElement(BlockGiftPicker as never, { props: { ...defaultsFor("gift-picker"), layout }, brand: DEFAULT_BRAND, onFieldChange: () => {} } as never);
    const builder = renderToStaticMarkup(createElement(StaticRenderContext.Provider, { value: true }, el));
    expect(builder).not.toContain("data-gift-select");
  });

  it("a gift with a second image keeps a separate flip control so a tap on the photo still selects", () => {
    const d = defaultsFor("gift-picker") as { options: Array<Record<string, unknown>> };
    const html = render(BlockGiftPicker as never, { ...d, options: [{ ...d.options[0], hoverImageUrl: "/img/back.webp" }, d.options[1]] }, true);
    expect(html).toContain('aria-label="Show the other view"');
    expect(html.match(/data-gift-select="true"/g)).toHaveLength(2);
  });
});
