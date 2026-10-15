import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StaticRenderContext } from "@/lib/reveal-fallback";
import { DEFAULT_BRAND } from "@/lib/brand-config";
import { BLOCK_REGISTRY, type DandySideImageV6BlockProps } from "@/lib/block-types";
import { BlockDandySideImageV6 } from "./BlockDandySideImageV6";

/**
 * Premium: Side Image Variation 6 — CTA style contract.
 * "buttons" (default) keeps the filled + outline buttons; "email-capture"
 * swaps both for the shared inline pill (email input + submit).
 */
function defaults(): DandySideImageV6BlockProps {
  const def = BLOCK_REGISTRY.find((d) => d.type === "dandy-side-image-v6");
  if (!def) throw new Error("missing registry entry");
  return def.defaultProps() as DandySideImageV6BlockProps;
}

function render(props: DandySideImageV6BlockProps): string {
  return renderToStaticMarkup(
    createElement(StaticRenderContext.Provider, { value: true }, createElement(BlockDandySideImageV6, { props, brand: DEFAULT_BRAND })),
  );
}

describe("dandy-side-image-v6 — CTA style", () => {
  it("defaults to the button pair and renders no email field", () => {
    const html = render({ ...defaults(), secondaryCtaText: "Learn more" });
    expect(html).toContain("Get a Free Demo");
    expect(html).toContain("Learn more");
    expect(html).not.toMatch(/type="email"/);
  });

  it("email-capture replaces both buttons with the inline pill, using the pill labels and the button colour override", () => {
    const html = render({
      ...defaults(),
      secondaryCtaText: "Learn more",
      ctaStyle: "email-capture",
      emailCapturePlaceholder: "Work email",
      emailCaptureButtonText: "Book my demo",
      ctaButtonColor: "#FF5500",
    });
    expect(html).toMatch(/<form[^>]*class="dandy-side-image-v6-pill"/);
    expect(html).toMatch(/<input[^>]*type="email"[^>]*placeholder="Work email"/);
    expect(html).toContain("Book my demo");
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*background:#FF5500/);
    expect(html).not.toContain("Get a Free Demo");
    expect(html).not.toContain("Learn more");
  });

  it("email-capture pill falls back to the CTA text for its button label", () => {
    const html = render({ ...defaults(), ctaStyle: "email-capture" });
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>Get a Free Demo</);
  });
});
