// @vitest-environment jsdom
/**
 * WordReveal paints each word from a dim color (default rgba(255,255,255,0.2))
 * to the bright color as the reader scrolls. In any static render — template
 * preview modals, thumbnail capture, the builder canvas — scroll progress
 * never advances, which left ENTIRE HEADLINES stuck at ~20%-opacity white
 * ("very transparent hero text" in the template library).
 *
 * Contract: under StaticRenderContext the final (bright) frame renders as a
 * plain span; the per-word scroll reveal is a live-page enhancement only.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { StaticRenderContext } from "@/lib/reveal-fallback";
import { WordReveal } from "./WordReveal";

const HEADLINE = "Quality doctors trust";
const DIM = /rgba\(255,\s*255,\s*255,\s*0\.2\)/;

function render(staticRender: boolean): string {
  return renderToStaticMarkup(
    createElement(
      StaticRenderContext.Provider,
      { value: staticRender },
      createElement(WordReveal, { text: HEADLINE }),
    ),
  );
}

describe("WordReveal — static render shows the final frame", () => {
  it("static render: full text present at the bright color, nothing dim", () => {
    const html = render(true);
    expect(html).toContain(HEADLINE);
    expect(html).toContain("#ffffff");
    expect(html).not.toMatch(DIM);
  });

  it("live render: the per-word scroll reveal still starts dim", () => {
    const html = render(false);
    expect(html).toContain("Quality");
    expect(html).toMatch(DIM);
  });

  it("HTML-formatted values keep their static path in both modes", () => {
    const htmlValue = 'Quality <span style="color:#C7E738">doctors</span> trust';
    const out = renderToStaticMarkup(
      createElement(
        StaticRenderContext.Provider,
        { value: true },
        createElement(WordReveal, { text: htmlValue }),
      ),
    );
    expect(out).toContain("#C7E738");
    expect(out).not.toMatch(DIM);
  });
});
