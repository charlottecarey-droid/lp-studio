import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it, vi } from "vitest";

/**
 * `videoPosition` on the stacked-video hero layout: "below" (default) keeps the
 * original order — copy + CTAs, then the showcase — and "above" puts the
 * showcase first. SSR-renders each case and compares where the headline and the
 * showcase video land in the markup. Other layouts ignore the prop.
 */
vi.mock("@/components/EmailCaptureModal", () => ({ EmailCaptureModal: () => null }));

import { BlockDsoHeartlandHero } from "./BlockDsoHeartlandHero";
import { DEFAULT_BRAND } from "@/lib/brand-config";
import type { DsoHeartlandHeroBlockProps } from "@/lib/block-types";

const CLIP = "/objects/showcase-clip.mp4";
const HEADLINE = "One partner for every location";

function render(overrides: Partial<DsoHeartlandHeroBlockProps>): string {
  const props = {
    layout: "stacked-video",
    eyebrow: "Partnership",
    headline: HEADLINE,
    subheadline: "Subheadline copy",
    primaryCtaText: "Book a call",
    primaryCtaUrl: "#",
    heroVideoUrl: CLIP,
    stats: [{ value: "9,876", label: "Faster" }],
    ...overrides,
  } as DsoHeartlandHeroBlockProps;
  return renderToStaticMarkup(createElement(BlockDsoHeartlandHero, { props, brand: DEFAULT_BRAND }));
}

function positions(markup: string) {
  const headline = markup.indexOf(HEADLINE);
  const video = markup.indexOf(`src="${CLIP}"`);
  // The nav bar repeats the primary CTA; the hero button is the last one.
  const cta = markup.lastIndexOf("Book a call");
  const stats = markup.indexOf("9,876");
  for (const [name, at] of Object.entries({ headline, video, cta, stats })) {
    expect(at, `${name} should render`).toBeGreaterThan(-1);
  }
  return { headline, video, cta, stats };
}

describe("dso-heartland-hero stacked-video videoPosition", () => {
  it("defaults to the showcase below the headline and CTAs (unchanged look)", () => {
    const markup = render({});
    const at = positions(markup);
    expect(at.headline).toBeLessThan(at.video);
    expect(at.cta).toBeLessThan(at.video);
    expect(at.video).toBeLessThan(at.stats);
    // An explicit "below" renders byte-for-byte the same as leaving it unset.
    expect(render({ videoPosition: "below" })).toBe(markup);
  });

  it('"above" puts the showcase first, then headline + CTAs, then stats', () => {
    const at = positions(render({ videoPosition: "above" }));
    expect(at.video).toBeLessThan(at.headline);
    expect(at.video).toBeLessThan(at.cta);
    expect(at.cta).toBeLessThan(at.stats);
  });

  it('"above" moves the top padding onto the showcase so it clears the nav', () => {
    const markup = render({ videoPosition: "above", heroTopPadding: 140 });
    const showcaseStart = markup.lastIndexOf("<div", markup.indexOf(`src="${CLIP}"`));
    expect(markup.slice(0, showcaseStart)).toMatch(/padding:140px 1\.5rem 0/);
    expect(markup).not.toMatch(/padding-top:140px/);
  });

  it("is ignored by the centered layout (no showcase)", () => {
    expect(render({ layout: "centered", videoPosition: "above" })).toBe(
      render({ layout: "centered" }),
    );
  });
});
