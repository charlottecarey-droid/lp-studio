import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * SSR smoke test for the Content Hub panels (Oct 2026 UX pass): every library
 * resource is a ROW with its thumbnail button at the top level (not buried in
 * a details section), the Style section stacks its three colour fields with
 * an editable hex input each, and the hero / featured panels surface their
 * image picker as a section of its own.
 */
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/components/BlockRefreshButton", () => ({ BlockRefreshButton: () => null }));
vi.mock("@/components/AiTextField", () => ({ AiTextField: ({ value }: { value: string }) => createElement("textarea", { defaultValue: value }) }));
vi.mock("@/components/VideoPicker", () => ({ VideoPicker: ({ value }: { value: string }) => createElement("input", { defaultValue: value, "data-video-picker": "" }) }));

import { BLOCK_REGISTRY } from "@/lib/block-types";
import { HubHeroPanel, HubFeaturedPanel, HubLibraryPanel, HubSupportPanel } from "./HubPanels";

const defaults = (type: string) => BLOCK_REGISTRY.find((d) => d.type === type)!.defaultProps() as Record<string, unknown>;
const render = (Panel: unknown, props: Record<string, unknown>) => renderToStaticMarkup(createElement(Panel as never, { props, onChange: () => {}, onApplyStyleToAll: () => {} } as never));

describe("Hub panels — findability contract", () => {
  it("library: one row per resource with a top-level thumbnail button; details stay collapsed", () => {
    const html = render(HubLibraryPanel, { ...defaults("hub-library"), sections: (defaults("hub-library").sections as unknown[]).slice(0, 1) });
    expect((html.match(/data-resource-row/g) ?? []).length).toBe(3);
    expect((html.match(/data-thumb-button="add"/g) ?? []).length).toBe(3);
    expect(html).not.toContain("data-video-picker"); // details collapsed by default
    expect(html).toContain("File, link &amp; description");
  });

  it("style section stacks three colour fields, each with an editable hex input", () => {
    const html = render(HubSupportPanel, defaults("hub-support"));
    expect((html.match(/type="color"/g) ?? []).length).toBe(3);
    expect((html.match(/placeholder="e\.g\. #1a1a1a"/g) ?? []).length).toBe(3);
    expect(html).not.toContain("grid-cols-3");
    expect(html).toContain("Apply this style to every hub block");
  });

  it("hero and featured panels surface the image picker as its own section", () => {
    expect(render(HubHeroPanel, defaults("hub-hero"))).toContain("Photo");
    expect(render(HubFeaturedPanel, defaults("hub-featured"))).toContain("Poster image");
  });
});
