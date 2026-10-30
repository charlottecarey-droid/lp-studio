import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

/**
 * feature-tabs-showcase media contract (Oct 2026): a tab without a screenshot
 * must never render an EMPTY browser frame on the live page. Tenants without
 * product shots hit this constantly — the image fill leaves product-detail
 * slots empty on purpose ("empty beats wrong") — so the live page paints the
 * Stack family's abstract product-UI placeholder instead. The editor keeps
 * InlineImage's "click Replace" affordance.
 */
import { StaticRenderContext } from "@/lib/reveal-fallback";
import { DEFAULT_BRAND } from "@/lib/brand-config";
import { BLOCK_REGISTRY } from "@/lib/block-types";
import { BlockFeatureTabsShowcase } from "./BlockFeatureTabsShowcase";

function defaults(): Record<string, unknown> {
  const def = BLOCK_REGISTRY.find((d) => d.type === "feature-tabs-showcase");
  if (!def) throw new Error("missing registry entry: feature-tabs-showcase");
  return def.defaultProps() as Record<string, unknown>;
}

function render(props: Record<string, unknown>, onFieldChange?: (p: Record<string, unknown>) => void): string {
  const el = createElement(BlockFeatureTabsShowcase as never, { props, brand: DEFAULT_BRAND, onFieldChange } as never);
  return renderToStaticMarkup(createElement(StaticRenderContext.Provider, { value: true }, el));
}

function withTabImages(url: string): Record<string, unknown> {
  const d = defaults();
  const tabs = (d.tabs as Array<Record<string, unknown>>).map((t) => ({ ...t, imageUrl: url }));
  return { ...d, tabs };
}

describe("feature-tabs-showcase — empty screenshot slot", () => {
  it("live page: a tab without a screenshot renders the placeholder graphic, never an empty frame or <img>", () => {
    const html = render(withTabImages(""));
    expect(html).toContain("gm-ph");
    expect(html).not.toContain("<img");
  });

  it("live page: a tab with a screenshot renders the <img> and no placeholder", () => {
    const html = render(withTabImages("https://img.example.com/shot.png"));
    expect(html).toContain("<img");
    expect(html).toContain("https://img.example.com/shot.png");
    expect(html).not.toContain("gm-ph");
  });

  it("editor: an empty slot keeps the InlineImage replace affordance instead of the placeholder", () => {
    const html = render(withTabImages(""), () => {});
    expect(html).not.toContain("gm-ph");
  });
});
