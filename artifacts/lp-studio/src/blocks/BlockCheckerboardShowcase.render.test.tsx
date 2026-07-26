/**
 * Render contract for checkerboard-showcase — the full-bleed alternating
 * "switchback" squares block (image/text tiles flipping sides per row, with
 * decorative gradient rails). Pins:
 *  1. Registry defaults render every tile's title/body + the header trio.
 *  2. Checkerboard alternation — odd rows carry the md:order flip classes.
 *  3. Rails render per tile (rotated micro-label present) and disappear
 *     entirely when showRails=false.
 *  4. Published view (no onFieldChange) hides empty-image tiles' builder
 *     hint; builder view shows it.
 */
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { BlockCheckerboardShowcase } from "./BlockCheckerboardShowcase";
import { createBlock } from "@/lib/block-types";
import type { CheckerboardShowcaseBlockProps } from "@/lib/block-types";
import { DEFAULT_BRAND } from "@/lib/brand-config";

function renderBlock(overrides: Partial<CheckerboardShowcaseBlockProps> = {}, builder = false) {
  const props = { ...(createBlock("checkerboard-showcase").props as CheckerboardShowcaseBlockProps), ...overrides };
  return renderToStaticMarkup(
    createElement(BlockCheckerboardShowcase, {
      props,
      brand: DEFAULT_BRAND,
      ...(builder ? { onFieldChange: () => {} } : {}),
    }),
  );
}

describe("BlockCheckerboardShowcase", () => {
  it("renders header + every tile from registry defaults", () => {
    const html = renderBlock();
    expect(html).toContain("Craftsmanship, down to the finest detail");
    expect(html).toContain("Fully integrated");
    expect(html).toContain("Edge-to-edge precision");
    expect(html).toContain("Go ahead, take a closer look");
    expect(html).toContain("Built to hold up");
  });

  it("alternates tile order — odd rows carry the md:order flip", () => {
    const html = renderBlock();
    // Row 2 (index 1) is reversed: its text tile gets md:order-2 and its
    // media tile md:order-1. Rows 1 and 3 don't.
    expect(html).toContain("md:order-2");
    expect(html).toContain("md:order-1");
  });

  it("renders a rail with the rotated micro-label per tile, and none when showRails=false", () => {
    const withRails = renderBlock();
    expect(withRails).toContain("Precision");
    expect(withRails).toContain("Durability");
    expect(withRails).toContain("vertical-rl");

    const without = renderBlock({ showRails: false });
    expect(without).not.toContain("vertical-rl");
    expect(without).not.toContain("Precision");
  });

  it("shows the add-image hint only on the builder canvas", () => {
    expect(renderBlock({}, true)).toContain("Add image URL in properties");
    expect(renderBlock({}, false)).not.toContain("Add image URL in properties");
  });

  it("renders provided images with object-cover and empty alt", () => {
    const html = renderBlock({
      items: [
        { title: "T", body: "B", imageUrl: "https://example.com/x.jpg", railLabel: "L" },
      ],
    });
    expect(html).toContain('src="https://example.com/x.jpg"');
    expect(html).toContain('alt=""');
    expect(html).toContain("object-cover");
  });
});
