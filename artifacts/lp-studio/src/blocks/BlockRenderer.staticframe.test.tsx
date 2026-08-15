// @vitest-environment jsdom
/**
 * Pins the static-frame contract at the renderer level:
 *
 *   animationsEnabled={false}  ⇒  blocks render under StaticRenderContext.
 *
 * The template-library preview modals (marketing + sales), the generation
 * live preview, and pages with animations turned off all pass
 * `animationsEnabled={false}`. Before this contract, that flag only skipped
 * the OUTER <Reveal> wrapper — every block-internal `whileInView`, entrance
 * fade, and scroll-driven opacity stayed armed, and inside dialogs/scaled
 * panes their observers and scroll tracking misfire: hero copy stranded at
 * opacity 0, scroll fades dimming whole sections ("template previews show
 * no headlines / everything transparent").
 *
 * Verified through the REAL BlockRenderer with a probe block that reports
 * what `useStaticRender()` resolves to where the block's own animation code
 * would consult it.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("./BlockHero", async () => {
  const { useStaticRender } = await import("@/lib/reveal-fallback");
  return {
    BlockHero: () => {
      const staticRender = useStaticRender();
      return createElement("div", { "data-static-render": String(staticRender) });
    },
  };
});

import { BlockRenderer } from "./BlockRenderer";
import { DEFAULT_BRAND } from "@/lib/brand-config";
import type { PageBlock } from "@/lib/block-types";

const probeBlock = {
  id: "hero-probe",
  type: "hero",
  props: { headline: "Probe" },
} as unknown as PageBlock;

function renderProbe(extra: { animationsEnabled?: boolean; isBuilder?: boolean }): string {
  return renderToStaticMarkup(
    createElement(BlockRenderer, { block: probeBlock, brand: DEFAULT_BRAND, ...extra }),
  );
}

describe("BlockRenderer — static-frame contract", () => {
  it("a normal viewer render keeps animations live (static=false)", () => {
    expect(renderProbe({})).toContain('data-static-render="false"');
  });

  it("animationsEnabled={false} puts blocks in a static render — the preview-modal fix", () => {
    expect(renderProbe({ animationsEnabled: false })).toContain('data-static-render="true"');
  });

  it("the builder canvas stays a static render (pre-existing behavior)", () => {
    expect(renderProbe({ isBuilder: true })).toContain('data-static-render="true"');
  });
});
