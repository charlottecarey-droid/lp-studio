/**
 * Render contract for checkerboard-showcase — the full-bleed alternating
 * "switchback" squares block (image/text tiles flipping sides per row, with
 * decorative gradient rails). Pins:
 *  1. Registry defaults render every tile's title/body + the header trio.
 *  2. Checkerboard alternation — odd rows carry the lg:order flip classes.
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

  it("alternates tile order — odd rows carry the lg:order flip", () => {
    const html = renderBlock();
    // Row 2 (index 1) is reversed: its text tile gets lg:order-2 and its
    // media tile lg:order-1. Rows 1 and 3 don't.
    expect(html).toContain("lg:order-2");
    expect(html).toContain("lg:order-1");
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

  it("applies the adjustable gutter with edge rules, and drops them at 0", () => {
    const framed = renderBlock({ sidePadding: 64 });
    // The gutter is a CSS var consumed by the lg: padding class, and the
    // vertical rules sit at the inset content edges.
    expect(framed).toContain("--cbs-gutter:64px");
    expect(framed).toContain("lg:px-[var(--cbs-gutter)]");
    expect(framed).toContain("left:var(--cbs-gutter)");
    expect(framed).toContain("right:var(--cbs-gutter)");

    const fullBleed = renderBlock({ sidePadding: 0 });
    expect(fullBleed).toContain("--cbs-gutter:0px");
    expect(fullBleed).not.toContain("left:var(--cbs-gutter)");

    // Out-of-range values clamp instead of blowing up the layout.
    expect(renderBlock({ sidePadding: 9999 })).toContain("--cbs-gutter:200px");
  });

  it("row separators bleed edge-to-edge through the gutters (100vw lines)", () => {
    const html = renderBlock();
    // Three tiles → one top rule + two between-row rules, all viewport-wide.
    const bleeds = html.match(/width:100vw/g) ?? [];
    expect(bleeds.length).toBe(3);
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
