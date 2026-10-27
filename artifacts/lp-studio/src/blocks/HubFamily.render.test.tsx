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
import { resolveHubPalette } from "@/lib/hub-theme";
import { BlockHubHero, activeNavIndex } from "./BlockHubHero";
import { BlockHubFeatured } from "./BlockHubFeatured";
import { BlockHubLibrary, filterAssets } from "./BlockHubLibrary";
import { BlockHubSupport } from "./BlockHubSupport";
import { assetKey, buildAssetEventPayload, opensInViewer, resolveAssetHref, resolveDownloadHref, type HubAsset } from "./hub/hub-assets";

const FAMILY = [
  ["hub-hero", BlockHubHero],
  ["hub-featured", BlockHubFeatured],
  ["hub-library", BlockHubLibrary],
  ["hub-support", BlockHubSupport],
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
    expect(html).toContain('href="#library"');
    expect(html).toContain('href="#featured"');
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
    expect(activeNavIndex(links, "/somewhere-else")).toBe(0);
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
    expect(html).toContain('href="https://help.example.com" target="_blank"');
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
