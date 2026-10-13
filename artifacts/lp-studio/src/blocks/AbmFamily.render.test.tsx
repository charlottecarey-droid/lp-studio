import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

/**
 * SSR smoke + contract test for the ABM account-page family (Oct 2026): the
 * brand-aware replica of the enterprise 1:1 account page idiom (abm-split-hero
 * … abm-ratings-cta).
 *
 * Pins: every block renders its default copy under the neutral DEFAULT_BRAND
 * on the surface its background preset dictates (dark hero + close, white /
 * stone sections); registry defaults leak no competitor or Dandy strings;
 * blocks without images never emit a broken `<img src="">` and never hide
 * content at opacity 0; the hero renders its OWN top bar with the brand mark,
 * nav links and the CTA; every CTA-bearing block uses the shared CtaButton
 * suite (`ctaText`/`ctaUrl`/`ctaAction` — the Page-CTA aliases) and honours
 * the five action modes; the background dropdown is honoured on every block;
 * media slots are named so the Page CTA can never clobber them.
 */
import { StaticRenderContext } from "@/lib/reveal-fallback";
import { DEFAULT_BRAND } from "@/lib/brand-config";
import { BLOCK_REGISTRY } from "@/lib/block-types";
import { resolveAbmPalette } from "@/lib/abm-theme";
import { BlockAbmSplitHero } from "./BlockAbmSplitHero";
import { BlockAbmPhoneShowcase } from "./BlockAbmPhoneShowcase";
import { BlockAbmSolutionTabs } from "./BlockAbmSolutionTabs";
import { BlockAbmIntegrationsRow } from "./BlockAbmIntegrationsRow";
import { BlockAbmStoryQuote } from "./BlockAbmStoryQuote";
import { BlockAbmLogoStrip } from "./BlockAbmLogoStrip";
import { BlockAbmRoiStats } from "./BlockAbmRoiStats";
import { BlockAbmFeatureGrid } from "./BlockAbmFeatureGrid";
import { BlockAbmReadingTiles } from "./BlockAbmReadingTiles";
import { BlockAbmAccountTeam } from "./BlockAbmAccountTeam";
import { BlockAbmRatingsCta } from "./BlockAbmRatingsCta";

const FAMILY = [
  ["abm-split-hero", BlockAbmSplitHero],
  ["abm-phone-showcase", BlockAbmPhoneShowcase],
  ["abm-solution-tabs", BlockAbmSolutionTabs],
  ["abm-integrations-row", BlockAbmIntegrationsRow],
  ["abm-story-quote", BlockAbmStoryQuote],
  ["abm-logo-strip", BlockAbmLogoStrip],
  ["abm-roi-stats", BlockAbmRoiStats],
  ["abm-feature-grid", BlockAbmFeatureGrid],
  ["abm-reading-tiles", BlockAbmReadingTiles],
  ["abm-account-team", BlockAbmAccountTeam],
  ["abm-ratings-cta", BlockAbmRatingsCta],
] as const;

const CTA_BLOCKS = ["abm-split-hero", "abm-solution-tabs", "abm-roi-stats", "abm-ratings-cta"] as const;
const DARK_DEFAULT = new Set(["abm-split-hero", "abm-ratings-cta"]);
const STONE_DEFAULT = new Set(["abm-integrations-row", "abm-roi-stats", "abm-reading-tiles"]);

function defaultsFor(type: string): Record<string, unknown> {
  const def = BLOCK_REGISTRY.find((d) => d.type === type);
  if (!def) throw new Error(`missing registry entry: ${type}`);
  return def.defaultProps() as Record<string, unknown>;
}

function render(Component: (p: never) => ReactElement, props: Record<string, unknown>, staticRender = true): string {
  const el = createElement(Component as never, { props, brand: DEFAULT_BRAND } as never);
  return renderToStaticMarkup(staticRender ? createElement(StaticRenderContext.Provider, { value: true }, el) : el);
}

const LEAK = /procore|mastec|skanska|meetdandy|#003a30|#c7e738|\bDandy\b|dental|dentist/i;

describe("ABM family — registry defaults render on the neutral brand", () => {
  it.each(FAMILY)("%s renders its default headline with no competitor / Dandy / dental leak, no broken <img>, nothing hidden", (type, Component) => {
    const props = defaultsFor(type);
    const html = render(Component as never, props);
    const headline = (((props.headline as string) || (props.quote as string)) ?? "").split("\n")[0];
    expect(headline.length).toBeGreaterThan(0);
    expect(html).toContain(headline.split("'")[0].slice(0, 12).replace(/&/g, "&amp;"));
    expect(html).not.toMatch(LEAK);
    expect(html).not.toMatch(/<img[^>]*src=""/);
    expect(html).not.toMatch(/opacity:\s*0[;"]/);
  });

  it.each(FAMILY)("%s paints the surface its background preset dictates", (type) => {
    const props = defaultsFor(type);
    const pal = resolveAbmPalette(props, DEFAULT_BRAND);
    if (DARK_DEFAULT.has(type)) {
      expect(props.backgroundStyle).toBe("black");
      expect(pal.dark).toBe(true);
    } else if (STONE_DEFAULT.has(type)) {
      expect(props.backgroundStyle).toBe("muted");
      expect(pal.dark).toBe(false);
    } else {
      expect(props.backgroundStyle).toBe("white");
      expect(pal.dark).toBe(false);
    }
  });

  it.each(FAMILY)("%s honours the background dropdown (preset AND custom hex) with contrast-safe inks", (type, Component) => {
    const base = defaultsFor(type);
    const dark = render(Component as never, { ...base, backgroundStyle: "dark" });
    expect(dark).toMatch(/<section[^>]*style="[^"]*background:var\(--lp-bg-dark/);
    const custom = render(Component as never, { ...base, backgroundStyle: undefined, bgColor: "#FFF4E6" });
    expect(custom).toMatch(/<section[^>]*style="[^"]*background:#FFF4E6/);
    const pal = resolveAbmPalette({ bgColor: "#FFF4E6" }, DEFAULT_BRAND);
    expect(pal.dark).toBe(false);
    expect(pal.text.toLowerCase()).not.toBe("#ffffff");
    const palDark = resolveAbmPalette({ backgroundStyle: "black" }, DEFAULT_BRAND);
    expect(palDark.dark).toBe(true);
    expect(palDark.text.toLowerCase()).not.toBe("#0b0b0f");
  });
});

describe("abm-split-hero — own top bar + CTA suite contract", () => {
  it("renders the sticky top bar with the nav links, the utility link and the CTA, plus the hero CTA", () => {
    const html = render(BlockAbmSplitHero as never, defaultsFor("abm-split-hero"));
    expect(html).toMatch(/class="abm-nav[^"]*sticky top-0/);
    expect(html).toContain('href="#platform"');
    expect(html).toContain('href="#solutions"');
    expect(html).toContain("Log in");
    // the CTA label appears in the bar AND in the hero body
    expect(html.match(/Contact your account team/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(html).toMatch(/lp-cta-btn/);
  });

  it("hides the bar with showNav=false and names its media slots so the Page CTA never clobbers them", () => {
    const defaults = defaultsFor("abm-split-hero");
    expect(defaults).toHaveProperty("mediaImageUrl");
    expect(defaults).toHaveProperty("mediaVideoUrl");
    expect(defaults).not.toHaveProperty("videoUrl");
    expect(defaults).not.toHaveProperty("imageUrl");
    const html = render(BlockAbmSplitHero as never, { ...defaults, showNav: false });
    expect(html).not.toMatch(/class="abm-nav/);
  });

  it("plays a native clip with the image as poster, and shows the brand × account lockup", () => {
    const html = render(BlockAbmSplitHero as never, { ...defaultsFor("abm-split-hero"), mediaVideoUrl: "/videos/a.mp4", mediaImageUrl: "/img/a.jpg", companyName: "Acme Corp" });
    expect(html).toMatch(/<video[^>]*src="\/videos\/a\.mp4"/);
    expect(html).toContain('poster="/img/a.jpg"');
    expect(html).toContain("Acme Corp");
  });
});

describe("CTA-bearing blocks — the shared suite", () => {
  it.each(CTA_BLOCKS)("%s declares ctaText / ctaUrl / ctaAction (Page-CTA aliases) and the secondary keys", (type) => {
    const d = defaultsFor(type);
    expect(typeof d.ctaText).toBe("string");
    expect(d.ctaUrl).toBeDefined();
    expect(d.ctaAction).toBe("url");
    expect(d).toHaveProperty("ctaSecondaryText");
    expect(d).toHaveProperty("ctaSecondaryAction");
  });

  it("renders a Chili Piper / modal / video action without crashing and keeps the filled-button marker", () => {
    for (const action of ["chilipiper", "modal-form", "modal-chilipiper", "video-modal"] as const) {
      const html = render(BlockAbmRatingsCta as never, { ...defaultsFor("abm-ratings-cta"), ctaAction: action, chilipiperUrl: "https://x.chilipiper.com/r", videoUrl: "https://www.youtube.com/watch?v=abc", ctaSecondaryText: "Watch", ctaSecondaryAction: "video-modal", secondaryVideoUrl: "/videos/b.mp4" });
      expect(html).toContain("Request a demo");
      expect(html).toContain("Watch");
      expect(html).toMatch(/lp-cta-filled/);
    }
  });

  it("abm-roi-stats fills its button with the section ink by default and the brand CTA colour on request", () => {
    const d = defaultsFor("abm-roi-stats");
    const ink = render(BlockAbmRoiStats as never, d);
    const pal = resolveAbmPalette(d, DEFAULT_BRAND, "#F5F1ED");
    expect(ink).toContain(`background:${pal.text}`);
    const accent = render(BlockAbmRoiStats as never, { ...d, ctaVariant: "accent" });
    expect(accent).toContain(`background:${pal.cta.bg}`);
  });
});

describe("sections — content contracts", () => {
  it("abm-phone-showcase renders the phone frame, four checklist rows and a placeholder screen when no media is set", () => {
    const html = render(BlockAbmPhoneShowcase as never, defaultsFor("abm-phone-showcase"));
    expect(html).toContain("data-abm-phone");
    expect(html.match(/<li/g)?.length).toBe(4);
    expect(html).not.toMatch(/<video/);
    const withClip = render(BlockAbmPhoneShowcase as never, { ...defaultsFor("abm-phone-showcase"), mediaVideoUrl: "/videos/app.mp4" });
    expect(withClip).toMatch(/<video[^>]*src="\/videos\/app\.mp4"/);
  });

  it("abm-solution-tabs renders every tab chip, the first panel's bullets and the arrow link", () => {
    const d = defaultsFor("abm-solution-tabs");
    const html = render(BlockAbmSolutionTabs as never, d);
    const tabs = d.tabs as Array<{ label: string; bullets?: string[] }>;
    for (const t of tabs) expect(html).toContain(t.label);
    expect(html).toMatch(/role="tab"[^>]*aria-selected="true"/);
    for (const b of tabs[0].bullets ?? []) expect(html).toContain(b);
    expect(html).toContain("abm-link");
  });

  it("abm-integrations-row renders a monogram tile per app when no icon is set", () => {
    const d = defaultsFor("abm-integrations-row");
    const html = render(BlockAbmIntegrationsRow as never, d);
    expect(html.match(/<li/g)?.length).toBe((d.items as unknown[]).length);
    expect(html).toContain(">MT<"); // Microsoft Teams
  });

  it("abm-story-quote paints the contrast card with the brand primary on a light section and wraps the quote in curly quotes", () => {
    const html = render(BlockAbmStoryQuote as never, defaultsFor("abm-story-quote"));
    expect(html).toContain(`background:${DEFAULT_BRAND.primaryColor}`);
    expect(html).toContain("“");
    expect(html).toContain("Read their story");
  });

  it("abm-logo-strip falls back to text wordmarks and abm-account-team to initials discs", () => {
    const logos = render(BlockAbmLogoStrip as never, defaultsFor("abm-logo-strip"));
    expect(logos).toContain("Northwind");
    expect(logos).not.toMatch(/<img/);
    const team = render(BlockAbmAccountTeam as never, defaultsFor("abm-account-team"));
    expect(team.match(/data-abm-headshot/g)?.length).toBe(5);
    expect(team).toContain(">AR<");
    expect(team).not.toMatch(/<img/);
  });

  it("abm-account-team caps at eight people", () => {
    const members = Array.from({ length: 10 }, (_, i) => ({ name: `Person ${i}` }));
    const html = render(BlockAbmAccountTeam as never, { ...defaultsFor("abm-account-team"), members });
    expect(html.match(/data-abm-headshot/g)?.length).toBe(8);
  });

  it("abm-feature-grid links a titled feature with an arrow and abm-reading-tiles links each tile", () => {
    const grid = render(BlockAbmFeatureGrid as never, defaultsFor("abm-feature-grid"));
    expect(grid.match(/class="abm-link no-underline"/g)?.length).toBe(6);
    const tiles = render(BlockAbmReadingTiles as never, defaultsFor("abm-reading-tiles"));
    expect(tiles).toContain("Recommended reading");
    expect(tiles.match(/aria-label="[^"]+"/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("abm-ratings-cta renders one star row per platform with the score line", () => {
    const html = render(BlockAbmRatingsCta as never, defaultsFor("abm-ratings-cta"));
    expect(html).toContain("4.5");
    expect(html).toContain("2,675");
    expect(html.match(/aria-label="[^"]*out of 5/g)?.length).toBe(4);
  });
});
