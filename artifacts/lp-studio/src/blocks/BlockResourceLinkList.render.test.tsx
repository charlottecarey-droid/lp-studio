import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

/**
 * SSR smoke + contract test for the Resource Link List block after entries
 * learned kinds (Nov 2026): plain links, uploaded PDFs and videos.
 *
 * Pins: legacy entries without `kind` render exactly as before (anchor to the
 * URL, new tab, no kind icon); PDF / video entries keep a real href so the
 * static render (and any client where the in-page viewer can't run) still
 * opens the file in a new tab; each kind shows its icon; the viewer stays
 * out of the builder render; `resourceLinkAsset` maps entries onto the
 * Content Hub asset model that the viewer consumes.
 */
import { StaticRenderContext } from "@/lib/reveal-fallback";
import { DEFAULT_BRAND } from "@/lib/brand-config";
import { BLOCK_REGISTRY } from "@/lib/block-types";
import type { ResourceLinkListBlockProps } from "@/lib/block-types";
import { BlockResourceLinkList, resourceLinkAsset } from "./BlockResourceLinkList";

const props: ResourceLinkListBlockProps = {
  headline: "Resources",
  groups: [
    {
      title: "Guides",
      links: [
        { label: "Help center article", url: "https://example.com/help" },
        { label: "Onboarding guide", url: "/api/storage/objects/uploads/guide.pdf", kind: "pdf" },
        { label: "Setup walkthrough", url: "https://www.youtube.com/watch?v=abc123", kind: "video" },
      ],
    },
  ],
};

function render(p: ResourceLinkListBlockProps, builder = false): string {
  const el = createElement(BlockResourceLinkList, { props: p, brand: DEFAULT_BRAND, onFieldChange: builder ? () => {} : undefined });
  return renderToStaticMarkup(createElement(StaticRenderContext.Provider, { value: true }, el));
}

describe("BlockResourceLinkList render", () => {
  it("renders every entry as a new-tab anchor to its URL, whatever its kind", () => {
    const html = render(props);
    expect(html).toContain('href="https://example.com/help"');
    expect(html).toContain('href="/api/storage/objects/uploads/guide.pdf"');
    expect(html).toContain('href="https://www.youtube.com/watch?v=abc123"');
    expect(html.match(/target="_blank"/g)?.length).toBeGreaterThanOrEqual(3);
    expect(html).toContain('data-kind="link"');
    expect(html).toContain('data-kind="pdf"');
    expect(html).toContain('data-kind="video"');
  });

  it("marks PDF and video entries with their icon and leaves plain links on the hover arrow", () => {
    const html = render(props);
    expect(html).toContain("lucide-file-text");
    expect(html).toContain("lucide-play");
    expect(html).toContain("lucide-arrow-up-right");
  });

  it("renders the registry defaults (legacy entries without a kind) unchanged", () => {
    const def = BLOCK_REGISTRY.find((b) => b.type === "resource-link-list")!.defaultProps() as ResourceLinkListBlockProps;
    const html = render(def);
    expect(html).toContain("Getting Started");
    expect(html).not.toContain("lucide-file-text");
    expect(html).not.toContain("lucide-play");
  });

  it("does not render the viewer inside the builder", () => {
    expect(() => render(props, true)).not.toThrow();
  });
});

describe("resourceLinkAsset", () => {
  it("maps PDF and video entries onto hub assets and ignores plain / empty links", () => {
    expect(resourceLinkAsset({ label: "Guide", url: "/a.pdf", kind: "pdf" })).toEqual({ kind: "pdf", title: "Guide", fileUrl: "/a.pdf" });
    expect(resourceLinkAsset({ label: "Clip", url: "https://vimeo.com/1", kind: "video" })).toEqual({ kind: "video", title: "Clip", videoUrl: "https://vimeo.com/1" });
    expect(resourceLinkAsset({ label: "Page", url: "https://x.com" })).toBeNull();
    expect(resourceLinkAsset({ label: "Blank", url: "#", kind: "pdf" })).toBeNull();
    expect(resourceLinkAsset({ label: "Blank", url: "  ", kind: "video" })).toBeNull();
  });
});
