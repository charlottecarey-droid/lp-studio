import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it } from "vitest";

/**
 * SSR smoke test for the section-kit header alias fix (July 2026). The AI
 * generator frequently emits the library-wide `headline`/`subheadline` names
 * instead of this family's `heading`/`subhead` (prod: ~5 of 8 recent
 * feature-photo-cards rows carried headline with heading empty), which
 * rendered the section with an eyebrow + subheadline but NO title. The nine
 * SectionBlockBase blocks now read the aliases as render-time fallbacks, so
 * already-saved pages heal on render.
 */
import { BlockFeaturePhotoCards } from "./BlockFeaturePhotoCards";
import { DEFAULT_BRAND } from "@/lib/brand-config";
import type { FeaturePhotoCardsBlockProps } from "@/lib/block-types";

function render(props: FeaturePhotoCardsBlockProps): string {
  return renderToStaticMarkup(
    createElement(BlockFeaturePhotoCards, { props, brand: DEFAULT_BRAND }),
  );
}

const items = [
  { title: "Feature one", description: "Does the thing.", image: "" },
  { title: "Feature two", description: "Does another thing.", image: "" },
];

describe("BlockFeaturePhotoCards — heading alias fallback", () => {
  it("renders the canonical heading/subhead when present", () => {
    const html = render({ eyebrow: "Features", heading: "Real title", subhead: "Real sub", items });
    expect(html).toContain("Real title");
    expect(html).toContain("Real sub");
  });

  it("falls back to AI-emitted headline/subheadline when heading/subhead are absent", () => {
    const html = render({
      eyebrow: "Features",
      headline: "Alias title",
      subheadline: "Alias sub",
      items,
    });
    expect(html).toContain("Alias title");
    expect(html).toContain("Alias sub");
  });

  it("canonical keys win over the aliases when both exist", () => {
    const html = render({
      heading: "Real title",
      headline: "Alias title",
      subhead: "Real sub",
      subheadline: "Alias sub",
      items,
    });
    expect(html).toContain("Real title");
    expect(html).not.toContain("Alias title");
    expect(html).toContain("Real sub");
    expect(html).not.toContain("Alias sub");
  });
});
