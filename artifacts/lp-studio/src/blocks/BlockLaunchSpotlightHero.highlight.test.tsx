import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it } from "vitest";

/**
 * Regression: the model sometimes injects <highlight>…</highlight> markup INTO
 * the launch-spotlight-hero headline (instead of relying on the separate
 * highlightWord prop). The renderer must strip the literal tags so they never
 * leak into the rendered hero, while still gradient-styling the wrapped phrase.
 */
import { BlockLaunchSpotlightHero } from "./BlockLaunchSpotlightHero";
import { DEFAULT_BRAND } from "@/lib/brand-config";
import type { LaunchSpotlightHeroBlockProps } from "@/lib/block-types";

function render(props: LaunchSpotlightHeroBlockProps): string {
  return renderToStaticMarkup(
    createElement(BlockLaunchSpotlightHero, { props, brand: DEFAULT_BRAND }),
  );
}

describe("BlockLaunchSpotlightHero highlight-markup handling", () => {
  it("strips <highlight> tags from the headline and never renders the literal markup", () => {
    const html = render({
      headline: "Connect smarter with our <highlight>AI-first</highlight> platform",
      highlightWord: "AI-first",
    } as LaunchSpotlightHeroBlockProps);
    expect(html).not.toContain("<highlight>");
    expect(html).not.toContain("&lt;highlight&gt;");
    expect(html).not.toContain("</highlight>");
    expect(html).toContain("Connect smarter with our");
    expect(html).toContain("AI-first");
    expect(html).toContain("platform");
  });

  it("adopts the wrapped phrase as the highlight target when highlightWord is unset", () => {
    const html = render({
      headline: "Ship <highlight>beautiful products</highlight> faster",
    } as LaunchSpotlightHeroBlockProps);
    expect(html).not.toContain("<highlight>");
    expect(html).not.toContain("&lt;highlight&gt;");
    // The wrapped phrase should be gradient-clipped (its own styled span).
    expect(html).toContain("beautiful products");
    expect(html).toContain("background-clip:text");
  });

  it("leaves a clean headline untouched", () => {
    const html = render({
      headline: "The fastest way to launch",
      highlightWord: "launch",
    } as LaunchSpotlightHeroBlockProps);
    expect(html).not.toContain("<highlight>");
    expect(html).toContain("The fastest way to");
    expect(html).toContain("launch");
  });
});
