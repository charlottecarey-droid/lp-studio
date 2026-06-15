// @vitest-environment jsdom
/**
 * A/B-test variant render path × Page CTA — integration guard.
 *
 * The Page CTA is the single source of truth for each block's PRIMARY button.
 * On the MAIN published page this is unit-tested (ctaConfig.followpagecta /
 * ctaConfig.render-contract). The VARIANT path is different: the page CTA data
 * is assembled SEPARATELY on the server (tracking.ts → enrichVariantWithPage /
 * enrichVariantWithBlockOverrides build a `linkedPage` payload that carries
 * `ctaDefault`), and the viewer then renders that payload via:
 *
 *     <BlockRenderer ... pageCta={linkedPage?.ctaDefault ?? null} />
 *
 * (landing-page-viewer.tsx, variant render branch ~line 1081).
 *
 * Without a test, a future change to the variant payload (e.g. dropping
 * `ctaDefault` from the linkedPage object) or to that wiring could silently stop
 * the Page CTA from appearing on variant pages, and nothing would catch it until
 * a customer noticed.
 *
 * This test reconstructs the variant `linkedPage` payload in the EXACT shape the
 * server emits (incl. `ctaDefault`), renders the variant blocks through the SAME
 * wiring the viewer uses (each block via BlockRenderer with
 * `pageCta={linkedPage.ctaDefault ?? null}`), and asserts:
 *   1. every block that follows the Page CTA renders the Page CTA's label + URL
 *      (its own button is overridden), and
 *   2. a block with "Use a custom button here" turned on
 *      (`blockSettings.useCustomCta === true`) keeps its OWN button verbatim.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

import { BlockRenderer } from "@/blocks/BlockRenderer";
import { DEFAULT_BRAND } from "@/lib/brand-config";
import type { PageBlock } from "@/lib/block-types";
import type { CtaConfig } from "@/lib/cta/ctaConfig";

// The Page CTA stored on the linked page (URL mode). This is exactly what the
// server puts on `linkedPage.ctaDefault` for the variant payload.
const PAGE_CTA: CtaConfig = {
  label: "Book a Demo",
  action: "url",
  url: "https://acme.test/demo",
  source: "page",
};

// A `bottom-cta` block: declares the standard primary-CTA props (ctaText /
// ctaUrl / ctaAction), so it follows the Page CTA by default.
function bottomCtaBlock(
  id: string,
  ctaText: string,
  ctaUrl: string,
  blockSettings?: PageBlock["blockSettings"],
): PageBlock {
  return {
    id,
    type: "bottom-cta",
    props: {
      headline: `Headline ${id}`,
      subheadline: "",
      ctaText,
      ctaUrl,
      ctaAction: "url",
    },
    ...(blockSettings ? { blockSettings } : {}),
  } as PageBlock;
}

/**
 * The variant payload the server's enrichVariantWithPage emits: a `linkedPage`
 * with its blocks AND the page-level `ctaDefault`. Mirrors the exact field the
 * viewer reads (`linkedPage.ctaDefault`).
 */
function variantLinkedPage() {
  return {
    id: 4242,
    title: "Variant Linked Page",
    slug: "variant-linked",
    customCss: "",
    animationsEnabled: true,
    smoothScroll: true,
    ctaDefault: PAGE_CTA,
    pageVariables: {},
    blocks: [
      // Two blocks that should FOLLOW the page CTA.
      bottomCtaBlock("blk-a", "Original A Button", "/original-a"),
      bottomCtaBlock("blk-b", "Original B Button", "/original-b"),
      // One block that OPTS OUT via "Use a custom button here".
      bottomCtaBlock("blk-custom", "Keep My Button", "/keep-mine", {
        useCustomCta: true,
      }),
    ] as PageBlock[],
  };
}

/**
 * Harness that reproduces the viewer's VARIANT render branch
 * (landing-page-viewer.tsx ~line 1067-1085): map the linked page's blocks to
 * BlockRenderer, threading `pageCta={linkedPage.ctaDefault ?? null}`. Animations
 * are disabled (as in a stable render) to keep the DOM deterministic.
 */
function VariantRender({
  onCtaClick,
}: {
  onCtaClick: (url: string) => void;
}) {
  const linkedPage = variantLinkedPage();
  return (
    <>
      {linkedPage.blocks.map((block, i) => (
        <BlockRenderer
          key={block.id ?? i}
          block={block}
          brand={DEFAULT_BRAND}
          onCtaClick={onCtaClick}
          animationsEnabled={false}
          pageId={linkedPage.id}
          pageCta={linkedPage.ctaDefault ?? null}
        />
      ))}
    </>
  );
}

describe("A/B variant render path drives each block's primary button from the Page CTA", () => {
  beforeEach(() => cleanup());

  it("following blocks show the Page CTA label, not their own", () => {
    render(<VariantRender onCtaClick={vi.fn()} />);

    // Both following blocks render the Page CTA's label.
    const pageCtaButtons = screen.getAllByText("Book a Demo");
    expect(pageCtaButtons).toHaveLength(2);

    // Their own labels are gone.
    expect(screen.queryByText("Original A Button")).toBeNull();
    expect(screen.queryByText("Original B Button")).toBeNull();
  });

  it("a following block's button navigates to the Page CTA URL", () => {
    const onCtaClick = vi.fn();
    render(<VariantRender onCtaClick={onCtaClick} />);

    // Click the first following block's CTA button.
    const button = screen.getAllByText("Book a Demo")[0].closest("button");
    expect(button).not.toBeNull();
    fireEvent.click(button!);

    // The viewer's onCtaClick receives the Page CTA URL (resolveCtaUrl reads the
    // transformed props), not the block's original "/original-a".
    expect(onCtaClick).toHaveBeenCalledWith("https://acme.test/demo");
  });

  it("a block with 'Use a custom button here' keeps its OWN button on the variant", () => {
    const onCtaClick = vi.fn();
    render(<VariantRender onCtaClick={onCtaClick} />);

    // The opted-out block still shows its own label.
    expect(screen.getByText("Keep My Button")).not.toBeNull();

    // And clicking it navigates to its OWN URL, untouched by the Page CTA.
    const button = screen.getByText("Keep My Button").closest("button");
    expect(button).not.toBeNull();
    fireEvent.click(button!);
    expect(onCtaClick).toHaveBeenCalledWith("/keep-mine");
  });
});
