import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it } from "vitest";

/**
 * SSR smoke test for the outlined-cards pillar block's "showcase" variant
 * (Procore-style row of two large outlined feature cards below the pillars:
 * a big-image feature card and a customer-story card). Legacy pages
 * with `variant` unset must render exactly the pillar cards and nothing else.
 */
import { BlockValuePillarsOutlinedCards } from "./BlockValuePillarsOutlinedCards";
import { DEFAULT_BRAND } from "@/lib/brand-config";
import type { ValuePillarsOutlinedCardsBlockProps } from "@/lib/block-types";
import { OUTLINED_CARDS_SHOWCASE_DEFAULTS } from "@/lib/block-types";

const baseProps: ValuePillarsOutlinedCardsBlockProps = {
  eyebrow: "Why us",
  heading: "Built for the whole team",
  subhead: "One platform from bid to close-out.",
  items: [
    { icon: "Rocket", title: "Start faster", description: "Templates for every job." },
    { icon: "Shield", title: "Reduce risk", description: "Approvals built in." },
    { icon: "BarChart", title: "See the numbers", description: "Live reporting." },
  ],
};

function render(props: ValuePillarsOutlinedCardsBlockProps): string {
  return renderToStaticMarkup(
    createElement(BlockValuePillarsOutlinedCards, { props, brand: DEFAULT_BRAND }),
  );
}

describe("BlockValuePillarsOutlinedCards render", () => {
  it("renders the pillar cards and header copy", () => {
    const html = render(baseProps);
    expect(html).toContain("Built for the whole team");
    for (const item of baseProps.items ?? []) {
      expect(html).toContain(item.title as string);
    }
  });

  it("renders NO showcase markup when variant is unset (legacy pages)", () => {
    const html = render(baseProps);
    expect(html).not.toContain("lg:grid-cols-2");
    expect(html).not.toContain(OUTLINED_CARDS_SHOWCASE_DEFAULTS.showcaseFeatureTitle);
    expect(html).not.toContain(OUTLINED_CARDS_SHOWCASE_DEFAULTS.showcaseStoryName);
  });

  it("renders NO showcase markup when variant is explicitly cards", () => {
    const html = render({ ...baseProps, variant: "cards" });
    expect(html).not.toContain("lg:grid-cols-2");
    expect(html).not.toContain(OUTLINED_CARDS_SHOWCASE_DEFAULTS.showcaseFeatureEyebrow);
  });
});

describe("BlockValuePillarsOutlinedCards showcase variant", () => {
  const showcaseProps: ValuePillarsOutlinedCardsBlockProps = {
    ...baseProps,
    variant: "showcase",
  };

  it("renders both feature cards with default copy when fields are unset", () => {
    const html = render(showcaseProps);
    // Big-image feature card.
    expect(html).toContain(OUTLINED_CARDS_SHOWCASE_DEFAULTS.showcaseFeatureEyebrow);
    expect(html).toContain(OUTLINED_CARDS_SHOWCASE_DEFAULTS.showcaseFeatureTitle);
    // Customer-story card.
    expect(html).toContain("Customer story");
    expect(html).toContain(OUTLINED_CARDS_SHOWCASE_DEFAULTS.showcaseStoryName);
    expect(html).toContain(OUTLINED_CARDS_SHOWCASE_DEFAULTS.showcaseStoryRole);
    expect(html).toContain(OUTLINED_CARDS_SHOWCASE_DEFAULTS.showcaseStoryCompany);
    expect(html).toContain("partners");
  });

  it("lays out the two big cards side by side with image areas", () => {
    const html = render(showcaseProps);
    expect(html).toContain("lg:grid-cols-2");
    // Both cards render a 16/10 image frame (placeholder panels when unset).
    expect(html.match(/aspect-\[16\/10\]/g)?.length).toBe(2);
  });

  it("prefers authored copy over the defaults", () => {
    const html = render({
      ...showcaseProps,
      showcaseFeatureTitle: "Plays well with your stack",
      showcaseStoryQuote: "Custom quote line.",
    });
    expect(html).toContain("Plays well with your stack");
    expect(html).toContain("Custom quote line.");
    expect(html).not.toContain(OUTLINED_CARDS_SHOWCASE_DEFAULTS.showcaseFeatureTitle);
  });

  it("uses authored images when provided", () => {
    const html = render({
      ...showcaseProps,
      showcaseFeatureImage: "https://example.com/product.jpg",
      showcaseStoryImage: "https://example.com/portrait.jpg",
    });
    expect(html).toContain("https://example.com/product.jpg");
    expect(html).toContain("https://example.com/portrait.jpg");
  });
});
