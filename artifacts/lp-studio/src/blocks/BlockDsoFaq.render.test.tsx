import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it, vi } from "vitest";

/**
 * SSR smoke test for the FAQ block after the premium redesign (divider rows,
 * left-side +/× toggle, adjustable itemSize). Guards against render-time
 * crashes (the block is wrapped in a BlockErrorBoundary in the app, so a
 * throw silently blanks the section for users).
 */
vi.mock("@/components/ChiliPiperButton", () => ({ ChiliPiperButton: () => null }));
vi.mock("@/components/BlockDsoCta", () => ({ BlockDsoCta: () => null }));

import { BlockDsoFaq } from "./BlockDsoFaq";
import { DEFAULT_BRAND } from "@/lib/brand-config";
import type { DsoFaqBlockProps } from "@/lib/block-types";

const baseProps: DsoFaqBlockProps = {
  eyebrow: "FAQ",
  headline: "Common questions",
  subheadline: "What businesses ask us most.",
  items: [
    { question: "How long does setup take?", answer: "About a week." },
    { question: "Is my data secure?", answer: "Yes, encrypted end to end." },
  ],
};

function render(props: DsoFaqBlockProps): string {
  return renderToStaticMarkup(
    createElement(BlockDsoFaq, { props, brand: DEFAULT_BRAND }),
  );
}

describe("BlockDsoFaq render", () => {
  it("renders questions with a left-side plus toggle and divider rows", () => {
    const html = render(baseProps);
    expect(html).toContain("How long does setup take?");
    expect(html).toContain("Is my data secure?");
    expect(html).toContain("lucide-plus");
    expect(html).not.toContain("lucide-chevron-down");
  });

  it("scales question size with itemSize", () => {
    const md = render(baseProps);
    const lg = render({ ...baseProps, itemSize: "lg" });
    const sm = render({ ...baseProps, itemSize: "sm" });
    expect(md).toContain("font-size:1.25rem");
    expect(lg).toContain("font-size:1.5rem");
    expect(sm).toContain("font-size:1rem");
  });

  it("survives an unknown itemSize value from legacy/AI data", () => {
    const html = render({
      ...baseProps,
      itemSize: "huge" as unknown as DsoFaqBlockProps["itemSize"],
    });
    expect(html).toContain("How long does setup take?");
    expect(html).toContain("font-size:1.25rem");
  });
});
