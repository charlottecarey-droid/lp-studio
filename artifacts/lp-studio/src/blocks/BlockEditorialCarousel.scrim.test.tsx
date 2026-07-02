import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it } from "vitest";

/**
 * Guards the optional caption scrim ("gradient glow") on the editorial
 * carousel's image mode. Legacy pages have no stored `showScrim` value, so
 * the scrim must stay ON unless the author explicitly turns it off
 * (default-ON flags are read as `!== false` per convention).
 */
import { BlockEditorialCarousel } from "./BlockEditorialCarousel";
import { DEFAULT_BRAND } from "@/lib/brand-config";
import type { EditorialCarouselBlockProps } from "@/lib/block-types";

const baseProps: EditorialCarouselBlockProps = {
  headline: "Moments from the summit",
  slides: [
    { src: "https://example.com/a.jpg", alt: "A", caption: "Dusk over the ridge" },
    { src: "https://example.com/b.jpg", alt: "B", caption: "First light" },
  ],
};

const SCRIM_MARKER = "linear-gradient(to top";

function render(props: EditorialCarouselBlockProps): string {
  return renderToStaticMarkup(
    createElement(BlockEditorialCarousel, { props, brand: DEFAULT_BRAND }),
  );
}

describe("BlockEditorialCarousel caption scrim", () => {
  it("keeps the scrim for legacy pages with no stored value", () => {
    expect(render(baseProps)).toContain(SCRIM_MARKER);
  });

  it("keeps the scrim when explicitly enabled", () => {
    expect(render({ ...baseProps, showScrim: true })).toContain(SCRIM_MARKER);
  });

  it("removes the scrim when turned off, captions still render", () => {
    const html = render({ ...baseProps, showScrim: false });
    expect(html).not.toContain(SCRIM_MARKER);
    expect(html).toContain("Dusk over the ridge");
  });

  it("does not affect the case-study readability scrim (separate layout option)", () => {
    const props: EditorialCarouselBlockProps = {
      ...baseProps,
      mode: "case-study",
      layout: "overlay-scrim",
      showScrim: false,
      slides: [{ src: "https://example.com/a.jpg", alt: "A", headline: "Case" }],
    };
    expect(render(props)).toContain(SCRIM_MARKER);
  });
});
