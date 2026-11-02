import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BlockDsoMinimalHero, DSO_MINIMAL_HERO_DEFAULT_PROPS } from "./BlockDsoMinimalHero";
import { StaticRenderContext } from "@/lib/reveal-fallback";
import { BLOCK_REGISTRY } from "@/lib/block-types/block-registry";
import { DEFAULT_BRAND } from "@/lib/brand-config";
import { getDefaultBlockTags } from "@workspace/lp-template-engine";

// DSO — Minimal hero (Nov 2026). Static render carries nav, two-tone headline,
// support line, CTAs, media card and the number row.
describe("BlockDsoMinimalHero", () => {
  it("renders nav, two-tone headline, CTAs, media and numbers under static render", () => {
    const html = renderToStaticMarkup(
      <StaticRenderContext.Provider value={true}>
        <BlockDsoMinimalHero
          brand={{ ...DEFAULT_BRAND, brandName: "Acme" }}
          props={{
            ...DSO_MINIMAL_HERO_DEFAULT_PROPS,
            headline: "The lab built for enterprise growth.",
            headlineMuted: "Every service improved for groups.",
            ctaText: "Schedule a demo",
            ctaSecondaryText: "See the story",
            mediaVideoUrl: "/videos/clip.mp4",
            mediaImageUrl: "https://example.com/poster.jpg",
            stats: [{ value: "50%", label: "Fewer appointments" }, { value: "$0", label: "CapEx" }],
          }}
        />
      </StaticRenderContext.Provider>,
    );
    expect(html).toContain('data-block="dso-minimal-hero"');
    expect(html).toContain("<nav");
    expect(html).toContain("The lab built for enterprise growth.");
    expect(html).toContain("Every service improved for groups.");
    expect(html).toContain("Schedule a demo");
    expect(html).toContain("See the story");
    expect(html).toContain('<video src="/videos/clip.mp4"');
    expect(html).toContain("50%");
    expect(html).toContain("Fewer appointments");
  });

  it("hides the nav when showNav is false", () => {
    const html = renderToStaticMarkup(
      <StaticRenderContext.Provider value={true}>
        <BlockDsoMinimalHero brand={DEFAULT_BRAND} props={{ ...DSO_MINIMAL_HERO_DEFAULT_PROPS, showNav: false }} />
      </StaticRenderContext.Provider>,
    );
    expect(html).not.toContain("<nav");
  });

  it("is registered with brand-neutral defaults and hero tags", () => {
    const def = BLOCK_REGISTRY.find((b) => b.type === "dso-minimal-hero");
    expect(def).toBeTruthy();
    expect(JSON.stringify(def!.defaultProps()).toLowerCase()).not.toMatch(/dandy|dental|denture|crown/);
    expect(getDefaultBlockTags("dso-minimal-hero")).toEqual(["hero", "media"]);
  });
});
