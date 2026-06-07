import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it } from "vitest";

import { BlockDsoCaseStudy } from "./BlockDsoCaseStudy";
import { getBgStyle, isDarkBg, type BackgroundStyle } from "@/lib/bg-styles";
import type { DsoCaseStudyBlockProps, DsoCaseStudyExtraSection } from "@/lib/block-types";

/**
 * Text colors the block paints for body sections. These mirror the private
 * `FG`/`MU` constants inside `BlockDsoCaseStudy.tsx` (the sibling
 * `*.contrast.test.ts` files hardcode the same way). A dark band switches the
 * heading to `#fff`; a light band keeps the dark forest foreground.
 */
const FG = "hsl(152,40%,13%)"; // heading / body foreground on light bands
const MU = "hsl(152,8%,48%)"; // muted body copy on light bands

function render(props: DsoCaseStudyBlockProps): string {
  // No `onFieldChange` → builder-only popovers/pickers/upload affordances are
  // not rendered, so the markup is the published render.
  return renderToStaticMarkup(createElement(BlockDsoCaseStudy, { props }));
}

/** Split the markup into one chunk per top-level `<section>`. The block emits
 *  no nested `<section>` elements, so the trailing chunks are the additive
 *  editor-added sections (after the 3 built-in hero/body/results sections). */
function sectionChunks(markup: string): string[] {
  return markup.split("<section").slice(1);
}

/** Base block content shared across the section tests. All built-in bands are
 *  pinned to `white` so any dark band in the output must come from an extra
 *  section. */
function baseProps(sections: DsoCaseStudyExtraSection[]): DsoCaseStudyBlockProps {
  return {
    eyebrow: "Customer Story",
    headline: "A repeatable case study",
    subheadline: "With additive sections.",
    heroBackgroundStyle: "white",
    bodyBackgroundStyle: "white",
    resultsBackgroundStyle: "white",
    backgroundStyle: "white",
    sections,
  };
}

describe("BlockDsoCaseStudy — legacy (no sections)", () => {
  it("renders identical markup whether `sections` is undefined or an empty array", () => {
    const withUndefined = render({ ...baseProps([]), sections: undefined });
    const withEmpty = render(baseProps([]));
    expect(withUndefined).toBe(withEmpty);
  });

  it("emits exactly the three built-in bands and no extra sections", () => {
    const markup = render({ ...baseProps([]), sections: undefined });
    // hero + body + results, nothing more.
    expect(sectionChunks(markup)).toHaveLength(3);
  });
});

describe("BlockDsoCaseStudy — additive sections backgrounds & contrast", () => {
  // Cover one representative light and one dark preset from each side of the
  // `isDarkBg` partition so the contrast assertion exercises both branches.
  const CASES: BackgroundStyle[] = ["white", "light-gray", "muted", "dark", "dandy-green", "black", "gradient"];

  for (const style of CASES) {
    it(`renders its own "${style}" background band and picks contrasting heading/body via isDarkBg`, () => {
      const markup = render(
        baseProps([
          { heading: "Extra heading", body: "Extra body copy.", backgroundStyle: style },
        ]),
      );

      const chunks = sectionChunks(markup);
      // 3 built-in + 1 extra.
      expect(chunks).toHaveLength(4);
      const extra = chunks[chunks.length - 1];

      // The band paints its own background from the section's own style.
      const bg = getBgStyle(style).background as string;
      expect(extra).toContain(bg);

      // The heading/body text colors follow the existing isDarkBg path.
      if (isDarkBg(style)) {
        expect(extra).toContain("color:#fff"); // heading on a dark band
        expect(extra).toContain("color:rgba(255,255,255,0.62)"); // body on a dark band
        expect(extra).not.toContain(`color:${FG}`);
      } else {
        expect(extra).toContain(`color:${FG}`); // heading on a light band
        expect(extra).toContain(`color:${MU}`); // body on a light band
      }
    });
  }

  it("gives each section its own independent background band", () => {
    const markup = render(
      baseProps([
        { heading: "Light one", body: "Body.", backgroundStyle: "white" },
        { heading: "Dark one", body: "Body.", backgroundStyle: "dark" },
      ]),
    );

    const chunks = sectionChunks(markup);
    expect(chunks).toHaveLength(5); // 3 built-in + 2 extra
    const [lightBand, darkBand] = chunks.slice(-2);

    expect(lightBand).toContain(getBgStyle("white").background as string);
    expect(lightBand).toContain(`color:${FG}`);

    expect(darkBand).toContain(getBgStyle("dark").background as string);
    expect(darkBand).toContain("color:#fff");
  });

  it("falls back to the block default background when a section omits its own", () => {
    const markup = render(
      baseProps([{ heading: "No bg", body: "Body." }]),
    );
    const extra = sectionChunks(markup).slice(-1)[0];
    // baseProps pins the block default to white → the section inherits it.
    expect(extra).toContain(getBgStyle("white").background as string);
  });
});

describe("BlockDsoCaseStudy — section pull quotes", () => {
  /** Count of `<blockquote>` elements emitted by the built-in body band alone
   *  (it always renders the default quote), with no extra sections. */
  const BASELINE_QUOTES = (render({ ...baseProps([]), sections: undefined }).match(/<blockquote/g) ?? []).length;

  it("renders a PullQuote for a section with a non-empty quote", () => {
    const markup = render(
      baseProps([{ heading: "H", body: "B", quote: "A real testimonial." }]),
    );
    const quotes = (markup.match(/<blockquote/g) ?? []).length;
    expect(quotes).toBe(BASELINE_QUOTES + 1);
    expect(markup).toContain("A real testimonial.");
  });

  it("does not render a PullQuote when the section quote is empty", () => {
    const markup = render(baseProps([{ heading: "H", body: "B", quote: "" }]));
    const quotes = (markup.match(/<blockquote/g) ?? []).length;
    expect(quotes).toBe(BASELINE_QUOTES);
  });

  it("does not render a PullQuote when the section quote is whitespace-only", () => {
    const markup = render(baseProps([{ heading: "H", body: "B", quote: "   " }]));
    const quotes = (markup.match(/<blockquote/g) ?? []).length;
    expect(quotes).toBe(BASELINE_QUOTES);
  });

  it("does not render a PullQuote when the section omits a quote entirely", () => {
    const markup = render(baseProps([{ heading: "H", body: "B" }]));
    const quotes = (markup.match(/<blockquote/g) ?? []).length;
    expect(quotes).toBe(BASELINE_QUOTES);
  });
});
