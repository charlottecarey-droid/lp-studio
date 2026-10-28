import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

/**
 * SSR smoke + contract test for the Content Hub block family (Oct 2026):
 * an ungated resource library (hub-hero, hub-featured, hub-library,
 * hub-support).
 *
 * Pins: every block renders its default copy under the neutral DEFAULT_BRAND;
 * registry defaults leak no Dandy strings; blocks without posters never emit
 * a broken `<img src="">` and never hide content at opacity 0; the hero
 * renders its own sticky top bar with the audience switch (first link active
 * when no path matches) and the jump CTA; the library renders every section
 * + card, offers a download only for files we host, sends links to a new
 * tab and keeps the search box; the support close renders a mailto pill
 * only when an email is set.
 */
import { StaticRenderContext } from "@/lib/reveal-fallback";
import { DEFAULT_BRAND } from "@/lib/brand-config";
import { relativeLuminance } from "@/lib/brand-config";
import { BLOCK_REGISTRY } from "@/lib/block-types";
import { HUB_THEMES, hubTokens, resolveHubPalette } from "@/lib/hub-theme";
import { BlockHubHero, activeNavIndex } from "./BlockHubHero";
import { BlockHubFeatured } from "./BlockHubFeatured";
import { BlockHubLibrary, filterAssets } from "./BlockHubLibrary";
import { BlockHubSupport } from "./BlockHubSupport";
import { BlockHubPaths } from "./BlockHubPaths";
import { assetKey, buildAssetEventPayload, buildHubInteractionPayload, opensInViewer, resolveAssetHref, resolveDownloadHref, type HubAsset } from "./hub/hub-assets";

const FAMILY = [
  ["hub-hero", BlockHubHero],
  ["hub-featured", BlockHubFeatured],
  ["hub-library", BlockHubLibrary],
  ["hub-support", BlockHubSupport],
  ["hub-paths", BlockHubPaths],
] as const;

function defaultsFor(type: string): Record<string, unknown> {
  const def = BLOCK_REGISTRY.find((d) => d.type === type);
  if (!def) throw new Error(`missing registry entry: ${type}`);
  return def.defaultProps() as Record<string, unknown>;
}

function render(Component: (p: never) => ReactElement, props: Record<string, unknown>, staticRender = true): string {
  const el = createElement(Component as never, { props, brand: DEFAULT_BRAND } as never);
  return renderToStaticMarkup(staticRender ? createElement(StaticRenderContext.Provider, { value: true }, el) : el);
}

const DANDY_LEAK = /meetdandy|dandysleep|#003a30|#00231d|#c7e738|\bDandy\b|sleep apnea|Highspot/i;

describe("Hub family — registry defaults render on the neutral brand", () => {
  it.each(FAMILY)("%s renders its default headline with no Dandy leak, no empty <img>, nothing hidden", (type, Component) => {
    const props = defaultsFor(type);
    const html = render(Component as never, props);
    const headline = ((props.headline as string) ?? ((props.asset as HubAsset | undefined)?.title ?? "")).split("\n")[0];
    expect(headline.length).toBeGreaterThan(0);
    expect(html).toContain(headline.split("'")[0].split("’")[0].slice(0, 10));
    expect(html).not.toMatch(DANDY_LEAK);
    expect(html).not.toMatch(/opacity:\s*0[;"]/);
    expect(html).not.toMatch(/<img[^>]*src=""/);
  });

  it("dark surfaces derive from the brand primary; paper surfaces stay near-white", () => {
    const dark = resolveHubPalette({}, DEFAULT_BRAND, "dark");
    const light = resolveHubPalette({}, DEFAULT_BRAND, "light");
    expect(dark.isDark).toBe(true);
    expect(relativeLuminance(dark.bg)).toBeLessThan(0.08);
    expect(light.isDark).toBe(false);
    expect(relativeLuminance(light.bg)).toBeGreaterThan(0.8);
    // A dark custom background flips a "light" block to the dark branch.
    expect(resolveHubPalette({ bgColor: "#101418" }, DEFAULT_BRAND, "light").isDark).toBe(true);
  });
});

describe("hub-hero — own top bar + audience switch contract", () => {
  it("renders the sticky bar, both audience links (first active without a matching path) and the jump CTAs", () => {
    const html = render(BlockHubHero as never, defaultsFor("hub-hero"));
    expect(html).toMatch(/class="sticky top-0/);
    expect((html.match(/data-hub-audience="active"/g) ?? []).length).toBe(1);
    expect((html.match(/data-hub-audience="inactive"/g) ?? []).length).toBe(1);
    expect(html).toContain('aria-current="page"');
    // Both CTAs are shared CtaButtons (link / form modal / Chili Piper / video) — buttons, not anchors.
    expect((html.match(/lp-cta-btn/g) ?? []).length).toBe(2);
    expect(html).toContain("Browse the library");
    expect(html).toContain("Start here");
    expect(html).not.toMatch(/<img/);
  });

  it("activeNavIndex matches the current path, ignoring trailing slashes, query and origin", () => {
    const links = [
      { label: "For dentists", url: "/dentists" },
      { label: "For patients", url: "https://dandysleep.com/patients/" },
    ];
    expect(activeNavIndex(links, "/patients")).toBe(1);
    expect(activeNavIndex(links, "/dentists/")).toBe(0);
    expect(activeNavIndex(links, "/patients?utm=x")).toBe(1);
    expect(activeNavIndex(links, "/somewhere-else")).toBe(-1); // the home page lights neither audience
    expect(activeNavIndex(links, null)).toBe(0);
    expect(activeNavIndex([], "/x")).toBe(-1);
  });
});

describe("hub-library — sections, cards, downloads and search", () => {
  const sections = [
    {
      kicker: "Step 1",
      title: "Set up",
      description: "First week.",
      items: [
        { key: "guide", kind: "pdf", title: "Quick-start guide", description: "Read first.", fileUrl: "/api/storage/objects/uploads/abc.pdf", meta: "4 pages" },
        { kind: "video", title: "Tour", description: "Watch.", videoUrl: "https://www.youtube.com/watch?v=abc123", meta: "2 min" },
        { kind: "link", title: "Help center", description: "Articles.", externalUrl: "https://help.example.com", meta: "Help" },
        { kind: "pdf", title: "Not uploaded yet", description: "Fallback.", fileUrl: "", externalUrl: "https://viewer.example.com/x" },
      ] as HubAsset[],
    },
    { kicker: "Anytime", title: "Reference", description: "", items: [{ kind: "pdf", title: "Pricing", description: "", fileUrl: "/docs/pricing.pdf" }] as HubAsset[] },
  ];

  it("renders every section with a rail entry, every card, and the search box", () => {
    const html = render(BlockHubLibrary as never, { ...defaultsFor("hub-library"), sections });
    expect((html.match(/data-hub-rail=/g) ?? []).length).toBe(2);
    expect(html).toContain('data-hub-rail="active"');
    expect((html.match(/data-hub-asset="pdf"/g) ?? []).length).toBe(3);
    expect((html.match(/data-hub-asset="video"/g) ?? []).length).toBe(1);
    expect((html.match(/data-hub-asset="link"/g) ?? []).length).toBe(1);
    expect(html).toContain("data-hub-search");
    expect(html).toContain('id="hub-s-set-up"');
    expect(html).toContain('id="hub-s-reference"');
    expect(html).toContain("5 resources");
  });

  it("offers a download only for hosted files, sends links + fallbacks to a new tab, and keeps real hrefs", () => {
    const html = render(BlockHubLibrary as never, { ...defaultsFor("hub-library"), sections });
    expect(html).toContain('aria-label="Download Quick-start guide"');
    expect(html).toContain('aria-label="Download Pricing"');
    expect(html).not.toContain('aria-label="Download Tour"'); // YouTube embed — nothing to download
    expect(html).not.toContain('aria-label="Download Not uploaded yet"'); // no file yet
    expect(html).toContain('href="https://help.example.com" target="_blank"');
    expect(html).toContain('href="https://viewer.example.com/x" target="_blank"');
    expect(html).toContain('href="/api/storage/objects/uploads/abc.pdf"');
  });

  it("stacked layout drops the rail; search can be hidden", () => {
    const html = render(BlockHubLibrary as never, { ...defaultsFor("hub-library"), sections, layout: "stacked", showSearch: false });
    expect(html).not.toContain("data-hub-rail=");
    expect(html).not.toContain("data-hub-search");
  });

  it("filterAssets matches title / description / meta, case-insensitively", () => {
    const items = sections[0].items;
    expect(filterAssets(items, "")).toHaveLength(4);
    expect(filterAssets(items, "GUIDE").map((a) => a.title)).toEqual(["Quick-start guide"]);
    expect(filterAssets(items, "2 min").map((a) => a.title)).toEqual(["Tour"]);
    expect(filterAssets(items, "articles").map((a) => a.title)).toEqual(["Help center"]);
    expect(filterAssets(items, "zzz")).toHaveLength(0);
  });
});

describe("hub-featured — spotlight contract", () => {
  it("renders the asset title, the verb pill and a placeholder poster without an <img>", () => {
    const html = render(BlockHubFeatured as never, defaultsFor("hub-featured"));
    expect(html).toContain("The two-minute overview");
    expect(html).toContain("data-hub-featured-cta");
    expect(html).toContain("Watch");
    expect(html).not.toMatch(/<img/);
  });

  it("uses the poster when set and the custom button label", () => {
    const props = defaultsFor("hub-featured") as { asset: HubAsset };
    const html = render(BlockHubFeatured as never, { ...props, buttonLabel: "Watch the explainer", asset: { ...props.asset, thumbnailUrl: "/poster.jpg", videoUrl: "/clip.mp4" } });
    expect(html).toContain('src="/poster.jpg"');
    expect(html).toContain("Watch the explainer");
    expect(html).toContain('href="/clip.mp4"');
  });
});

describe("hub-support — close contract", () => {
  it("renders no mailto pill without an email, and a mailto pill + disclaimer with one", () => {
    const bare = render(BlockHubSupport as never, defaultsFor("hub-support"));
    expect(bare).not.toContain("mailto:");
    const html = render(BlockHubSupport as never, { ...defaultsFor("hub-support"), email: "help@example.com", linkUrl: "https://help.example.com", disclaimer: "Educational information only." });
    expect(html).toContain('href="mailto:help@example.com"');
    expect(html).toContain("Email help@example.com");
    // The second button is a shared CtaButton (link by default) — rendered only with a destination.
    expect(html).toContain("Visit the help center");
    expect(html).toContain("lp-cta-btn");
    expect(html).toContain("Educational information only.");
  });
});

describe("hub-assets — href / download / key helpers", () => {
  it("resolves each kind's home URL and falls back to any other URL it carries", () => {
    expect(resolveAssetHref({ kind: "pdf", title: "a", fileUrl: "/a.pdf", externalUrl: "https://x" })).toBe("/a.pdf");
    expect(resolveAssetHref({ kind: "pdf", title: "a", fileUrl: "", externalUrl: "https://x" })).toBe("https://x");
    expect(resolveAssetHref({ kind: "video", title: "a", videoUrl: "", externalUrl: "https://x" })).toBe("https://x");
    expect(resolveAssetHref({ kind: "link", title: "a", externalUrl: "", fileUrl: "/f.pdf" })).toBe("/f.pdf");
    expect(opensInViewer({ kind: "pdf", title: "a", fileUrl: "/a.pdf" })).toBe(true);
    expect(opensInViewer({ kind: "pdf", title: "a", externalUrl: "https://x" })).toBe(false);
    expect(opensInViewer({ kind: "link", title: "a", externalUrl: "https://x" })).toBe(false);
  });

  it("a video file in our storage (no extension in the URL) counts as native: downloadable and played in <video>", () => {
    const stored: HubAsset = { kind: "video", title: "Chairside", videoUrl: "/api/storage/objects/uploads/6e9567eb-3c9e-433b-ba2a-1a79a39b8f84" };
    expect(resolveDownloadHref(stored)).toBe(stored.videoUrl);
    const embed: HubAsset = { kind: "video", title: "Tour", videoUrl: "https://www.youtube.com/watch?v=abc123" };
    expect(resolveDownloadHref(embed)).toBeNull();
    // A PDF in storage is not a video file, whatever its URL looks like.
    expect(resolveDownloadHref({ kind: "pdf", title: "Guide", fileUrl: "/api/storage/objects/uploads/x" })).toBe("/api/storage/objects/uploads/x");
  });

  it("downloads only hosted PDFs and native video files, never embeds or links, and respects the toggle", () => {
    expect(resolveDownloadHref({ kind: "pdf", title: "a", fileUrl: "/a.pdf" })).toBe("/a.pdf");
    expect(resolveDownloadHref({ kind: "pdf", title: "a", fileUrl: "/a.pdf", downloadable: false })).toBeNull();
    expect(resolveDownloadHref({ kind: "video", title: "a", videoUrl: "/clip.mp4" })).toBe("/clip.mp4");
    expect(resolveDownloadHref({ kind: "video", title: "a", videoUrl: "https://www.youtube.com/watch?v=x" })).toBeNull();
    expect(resolveDownloadHref({ kind: "link", title: "a", externalUrl: "https://x" })).toBeNull();
  });

  it("derives a stable analytics key and only builds a payload with a page + session", () => {
    expect(assetKey({ kind: "pdf", title: "Sleep Apnea Screening (v2)!" })).toBe("sleep-apnea-screening-v2");
    expect(assetKey({ kind: "pdf", title: "x", key: " custom-key " })).toBe("custom-key");
    expect(assetKey({ kind: "video", title: "" })).toBe("video");
    expect(buildAssetEventPayload({}, { kind: "pdf", title: "a" }, "view")).toBeNull();
    expect(buildAssetEventPayload({ pageId: 7, sessionId: "s", blockId: "b" }, { kind: "pdf", title: "A Guide" }, "download")).toEqual({
      pageId: 7, sessionId: "s", blockId: "b", assetKey: "a-guide", assetTitle: "A Guide", assetKind: "pdf", action: "download",
    });
  });
});

describe("Hub family — style presets", () => {
  const DANDY_LIKE = { ...DEFAULT_BRAND, primaryColor: "#113D33", accentColor: "#C8E63A", textColor: "#113D33", pageBackground: "#FDFCFA", cardBackground: "#ECEAE6", borderColor: "#ECEAE6" };

  it("defaults to the brand-site preset; an unknown value falls back to it", () => {
    expect(hubTokens(undefined).theme).toBe("site");
    expect(hubTokens("nope").theme).toBe("site");
    expect(HUB_THEMES).toEqual(["site", "midnight", "gallery", "mono"]);
  });

  it.each(HUB_THEMES)("%s: every block renders on the neutral brand with no Dandy leak and nothing hidden", (theme) => {
    for (const [type, Component] of FAMILY) {
      const html = render(Component as never, { ...defaultsFor(type), theme });
      expect(html).not.toMatch(DANDY_LEAK);
      expect(html).not.toMatch(/opacity:\s*0[;"]/);
      expect(html).not.toMatch(/<img[^>]*src=""/);
      expect(html).toContain("sticky top-0".slice(0, type === "hub-hero" ? 10 : 0));
    }
  });

  it("site: the hero sits on the brand's page background with the headline in the brand primary; the top bar is brand-dark", () => {
    const pal = resolveHubPalette({ theme: "site" }, DANDY_LIKE, "hero");
    expect(pal.isDark).toBe(false);
    expect(pal.bg.toUpperCase()).toBe("#FDFCFA");
    expect(pal.heading.toUpperCase()).toBe("#113D33");
    expect(pal.hairline.toUpperCase()).toBe("#ECEAE6");
    // Luminous accent stays a FILL, never accent text on paper.
    expect(pal.accentFill.toUpperCase()).toBe("#C8E63A");
    expect(pal.accent.toUpperCase()).not.toBe("#C8E63A");
    const html = render(BlockHubHero as never, { ...defaultsFor("hub-hero"), theme: "site" });
    expect(html).toContain("text-transform:uppercase");
    expect(html).toContain(`background:${resolveHubPalette({ theme: "site" }, DEFAULT_BRAND, "hero").dark.bg}`);
  });

  it("a brand with a coloured text colour reads in that colour in every preset; grey brand text keeps the editorial ink", () => {
    for (const theme of ["site", "gallery", "mono", "midnight"] as const) {
      const pal = resolveHubPalette({ theme }, DANDY_LIKE, "library");
      expect(pal.isDark).toBe(false);
      expect(pal.text.toUpperCase()).toBe("#113D33");
      expect(pal.heading.toUpperCase()).toBe("#113D33");
    }
    // Neutral brand (grey text colour): gallery / index keep a near-black editorial ink (the brand's grey), site still uses the primary headline.
    expect(resolveHubPalette({ theme: "gallery" }, DEFAULT_BRAND, "library").heading.toLowerCase()).toBe(DEFAULT_BRAND.textColor.toLowerCase());
    expect(resolveHubPalette({ theme: "mono" }, DEFAULT_BRAND, "library").text.toLowerCase()).toBe(DEFAULT_BRAND.textColor.toLowerCase());
    expect(resolveHubPalette({ theme: "site" }, DEFAULT_BRAND, "library").heading.toUpperCase()).toBe(DEFAULT_BRAND.primaryColor.toUpperCase());
    // A per-block text override still wins when it reads.
    expect(resolveHubPalette({ theme: "gallery", textColor: "#222244" }, DANDY_LIKE, "library").text.toUpperCase()).toBe("#222244");
  });

  it("midnight keeps the dark hero / dark close; a per-block surface override still wins over the preset", () => {
    expect(resolveHubPalette({ theme: "midnight" }, DEFAULT_BRAND, "hero").isDark).toBe(true);
    expect(resolveHubPalette({ theme: "midnight" }, DEFAULT_BRAND, "support").isDark).toBe(true);
    expect(resolveHubPalette({ theme: "midnight" }, DEFAULT_BRAND, "library").isDark).toBe(false);
    expect(resolveHubPalette({ theme: "site", surface: "dark" }, DEFAULT_BRAND, "hero").isDark).toBe(true);
    expect(resolveHubPalette({ theme: "midnight", surface: "light" }, DEFAULT_BRAND, "hero").isDark).toBe(false);
  });

  it("mono renders the library as hairline rows, the others as cards", () => {
    const base = defaultsFor("hub-library");
    const rows = render(BlockHubLibrary as never, { ...base, theme: "mono" });
    expect(rows).toContain('class="hub-row ');
    expect(rows).not.toContain('class="hub-card ');
    expect((rows.match(/data-hub-asset=/g) ?? []).length).toBe(5);
    const flat = render(BlockHubLibrary as never, { ...base, theme: "gallery" });
    expect(flat).toContain('class="hub-card-flat ');
    expect(flat).not.toContain('class="hub-row ');
    const site = render(BlockHubLibrary as never, { ...base, theme: "site" });
    expect(site).toContain('class="hub-card ');
  });

  it("gallery's featured spotlight renders the poster beside the copy; index renders an outline box", () => {
    const gallery = render(BlockHubFeatured as never, { ...defaultsFor("hub-featured"), theme: "gallery" });
    expect(gallery).toContain("aspect-ratio:16 / 10");
    expect(gallery).toContain("data-hub-featured-cta");
    const mono = render(BlockHubFeatured as never, { ...defaultsFor("hub-featured"), theme: "mono" });
    expect(mono).toContain("border:1px solid");
    expect(mono).toContain("data-hub-featured-cta");
  });
});

describe("Hub family — builder affordances (editor mode only)", () => {
  const editor = (Component: (p: never) => ReactElement, props: Record<string, unknown>) =>
    renderToStaticMarkup(createElement(StaticRenderContext.Provider, { value: true }, createElement(Component as never, { props, brand: DEFAULT_BRAND, onFieldChange: () => {} } as never)));

  it("library cards and rows carry an Add/Change-image pill in the editor and none when live", () => {
    const base = defaultsFor("hub-library");
    const live = render(BlockHubLibrary as never, base);
    expect(live).not.toContain("data-inline-image=");
    const cards = editor(BlockHubLibrary as never, base);
    expect((cards.match(/data-inline-image="add"/g) ?? []).length).toBe(5);
    const rows = editor(BlockHubLibrary as never, { ...base, theme: "mono" });
    expect((rows.match(/data-inline-image="add"/g) ?? []).length).toBe(5);
  });

  it("the featured poster and the hero photo slot get the pill; a set image reads Change", () => {
    expect(editor(BlockHubFeatured as never, defaultsFor("hub-featured"))).toContain('data-inline-image="add"');
    expect(editor(BlockHubFeatured as never, { ...defaultsFor("hub-featured"), asset: { ...(defaultsFor("hub-featured").asset as HubAsset), thumbnailUrl: "/api/storage/x.jpg" } })).toContain('data-inline-image="change"');
    const hero = editor(BlockHubHero as never, defaultsFor("hub-hero"));
    expect(hero).toContain("data-hub-photo-slot");
    expect(hero).toContain('data-inline-image="add"');
    expect(render(BlockHubHero as never, defaultsFor("hub-hero"))).not.toContain("data-hub-photo-slot");
    expect(editor(BlockHubHero as never, { ...defaultsFor("hub-hero"), theme: "midnight" })).toContain('data-inline-image="add"');
  });
});

describe("Hub family — shared CTA actions and the resource gate", () => {
  it("hero buttons are CtaButtons: a link renders a button that keeps the destination; a form action renders no link", () => {
    const html = render(BlockHubHero as never, defaultsFor("hub-hero"));
    expect((html.match(/lp-cta-btn/g) ?? []).length).toBe(2);
    const modal = render(BlockHubHero as never, { ...defaultsFor("hub-hero"), ctaAction: "modal-form", modalFormSource: "linked", modalFormId: 12 });
    expect(modal).toContain("lp-cta-btn");
    expect(modal).not.toMatch(/<form/); // closed until clicked
    // Legacy secondary keys still render.
    const legacy = render(BlockHubHero as never, { ...defaultsFor("hub-hero"), ctaSecondaryText: undefined, secondaryText: "Old secondary", secondaryUrl: "#featured" });
    expect(legacy).toContain("Old secondary");
  });

  it("support's second button follows the suite: hidden without a link in url mode, shown for a form action", () => {
    const base = { ...defaultsFor("hub-support"), email: "help@example.com", linkText: "Request a call" };
    expect(render(BlockHubSupport as never, { ...base, linkUrl: "" })).not.toContain("Request a call");
    expect(render(BlockHubSupport as never, { ...base, linkUrl: "", linkAction: "modal-form", modalFormSource: "simple" })).toContain("Request a call");
    expect(render(BlockHubSupport as never, { ...base, linkUrl: "https://help.example.com" })).toContain("Request a call");
  });

  it("the gate renders nothing extra while off or in the editor, and only its (closed) host when on", () => {
    const base = defaultsFor("hub-library");
    const off = render(BlockHubLibrary as never, base);
    expect(off).not.toContain("Unlock the full library");
    const on = render(BlockHubLibrary as never, { ...base, gate: { enabled: true, mode: "first-open" } });
    // Closed modal renders nothing; cards keep real hrefs so the first click can be intercepted client-side.
    expect(on).not.toContain("Unlock the full library");
    expect((on.match(/data-hub-seen=/g) ?? []).length).toBe(5);
    expect(render(BlockHubFeatured as never, { ...defaultsFor("hub-featured"), gate: { enabled: true } })).toContain("data-hub-seen=");
  });
});

describe("hub-assets — phase 3 beacon payloads", () => {
  const ctx = { pageId: 7, sessionId: "s", blockId: "b" };
  const a: HubAsset = { kind: "video", title: "Explainer", videoUrl: "/v.mp4" };
  it("carries a numeric value for watch milestones and time open, rounded and non-negative", () => {
    expect(buildAssetEventPayload(ctx, a, "progress", { value: 75 })).toMatchObject({ action: "progress", value: 75, assetKey: "explainer" });
    expect(buildAssetEventPayload(ctx, a, "time", { value: 12.6 })).toMatchObject({ action: "time", value: 13 });
    expect(buildAssetEventPayload(ctx, a, "time", { value: -4 })).toMatchObject({ value: 0 });
    expect(buildAssetEventPayload(ctx, a, "view")).not.toHaveProperty("value");
  });
  it("hub-level interactions use a synthetic asset of kind hub with the detail text", () => {
    expect(buildHubInteractionPayload(ctx, "search", { detail: "  titration ", value: 0 })).toMatchObject({ assetKind: "hub", assetKey: "_search", action: "search", detail: "titration", value: 0 });
    expect(buildHubInteractionPayload(ctx, "audience", { detail: "/patients" })).toMatchObject({ assetKey: "_audience", detail: "/patients" });
    expect(buildHubInteractionPayload({ sessionId: "s" }, "section", { detail: "x" })).toBeNull();
  });
});

describe("hub-paths — home-page audience chooser", () => {
  it("renders one card per path with its bullets and a button into its hub; the first button is solid", () => {
    const html = render(BlockHubPaths as never, defaultsFor("hub-paths"));
    expect((html.match(/data-hub-path="true"/g) ?? []).length).toBe(2);
    expect((html.match(/data-hub-path-cta/g) ?? []).length).toBe(2);
    expect(html).toContain('href="/teams"');
    expect(html).toContain('href="/customers"');
    expect(html).toContain("Short how-to videos");
    expect(html).not.toMatch(/<img/);
  });
  it("caps at three paths and switches to a three-column grid", () => {
    const paths = [1, 2, 3, 4].map((n) => ({ title: `Path ${n}`, ctaText: "Go", ctaUrl: `/${n}` }));
    const html = render(BlockHubPaths as never, { ...defaultsFor("hub-paths"), paths });
    expect((html.match(/data-hub-path="true"/g) ?? []).length).toBe(3);
    expect(html).toContain("lg:grid-cols-3");
  });
});
