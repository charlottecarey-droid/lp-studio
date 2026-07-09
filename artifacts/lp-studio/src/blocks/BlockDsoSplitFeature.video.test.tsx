// @vitest-environment jsdom
/**
 * Render test for the dso-split-feature Wistia video support: with a videoUrl
 * the image column becomes a play-button thumbnail that swaps to the Wistia
 * iframe in place (default) or opens a full-screen modal; with a video but no
 * image the player embeds directly; without a video the plain image renders
 * as before.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent, waitFor } from "@testing-library/react";

// jsdom has no IntersectionObserver; framer-motion's whileInView needs one at
// mount. Elements simply stay in their initial state, which is fine — these
// tests assert structure, not animation.
class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
}
(globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
  IntersectionObserverStub;
import { BlockDsoSplitFeature } from "@/blocks/BlockDsoSplitFeature";
import { createBlock } from "@/lib/block-types/block-registry";
import type { DsoSplitFeatureBlockProps } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";

const BRAND = { primaryColor: "#0f172a", accentColor: "#d7f463" } as BrandConfig;
const VIDEO = "https://dandy.wistia.com/medias/t7fcicxvhs";
const IFRAME_SRC = "fast.wistia.net/embed/iframe/t7fcicxvhs";

function props(overrides: Partial<DsoSplitFeatureBlockProps>): DsoSplitFeatureBlockProps {
  return { ...createBlock("dso-split-feature").props, ...overrides };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("BlockDsoSplitFeature video", () => {
  it("renders image + play button for a Wistia media link, swaps to autoplay iframe on click", () => {
    const { container, getByLabelText } = render(
      <BlockDsoSplitFeature props={props({ imageUrl: "https://cdn.example.com/thumb.jpg", videoUrl: VIDEO })} brand={BRAND} />,
    );
    expect(container.querySelector("img")?.getAttribute("src")).toContain("thumb.jpg");
    expect(container.querySelector("iframe")).toBeNull();

    fireEvent.click(getByLabelText("Play video"));
    const iframe = container.querySelector("iframe");
    expect(iframe?.getAttribute("src")).toContain(IFRAME_SRC);
    expect(iframe?.getAttribute("src")).toContain("autoPlay=true");
  });

  it("opens the modal instead when videoPlayMode is modal, and closes it", () => {
    const { container, getByLabelText } = render(
      <BlockDsoSplitFeature
        props={props({ imageUrl: "https://cdn.example.com/thumb.jpg", videoUrl: VIDEO, videoPlayMode: "modal" })}
        brand={BRAND}
      />,
    );
    fireEvent.click(getByLabelText("Play video"));
    const iframe = container.querySelector("iframe");
    expect(iframe?.getAttribute("src")).toContain(IFRAME_SRC);
    // The thumbnail is still there behind the modal (in-place swap didn't fire)
    expect(container.querySelector("img")).toBeTruthy();

    fireEvent.click(getByLabelText("Close video"));
    expect(container.querySelector("iframe")).toBeNull();
  });

  it("embeds the player directly (no autoplay) when a video is set without an image", () => {
    const { container } = render(
      <BlockDsoSplitFeature props={props({ imageUrl: undefined, videoUrl: VIDEO })} brand={BRAND} />,
    );
    const iframe = container.querySelector("iframe");
    expect(iframe?.getAttribute("src")).toContain(IFRAME_SRC);
    expect(iframe?.getAttribute("src")).not.toContain("autoPlay=true");
  });

  it("renders the plain image when no video is set (unchanged behavior)", () => {
    const { container, queryByLabelText } = render(
      <BlockDsoSplitFeature props={props({ imageUrl: "https://cdn.example.com/thumb.jpg" })} brand={BRAND} />,
    );
    expect(container.querySelector("img")?.getAttribute("src")).toContain("thumb.jpg");
    expect(container.querySelector("iframe")).toBeNull();
    expect(queryByLabelText("Play video")).toBeNull();
  });

  it("resolves a /s/ share link through oEmbed at render time (saved pages keep working)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ html: '<iframe src="https://fast.wistia.net/embed/iframe/t7fcicxvhs"></iframe>' }),
    })));
    const { container } = render(
      <BlockDsoSplitFeature
        props={props({ imageUrl: undefined, videoUrl: "https://dandy.wistia.com/s/r0zpnamhjfarc6a" })}
        brand={BRAND}
      />,
    );
    // Token is not embeddable — nothing renders until oEmbed resolves.
    expect(container.querySelector("iframe")).toBeNull();
    await waitFor(() => {
      expect(container.querySelector("iframe")?.getAttribute("src")).toContain(IFRAME_SRC);
    });
    expect(vi.mocked(fetch).mock.calls[0]![0]).toContain("fast.wistia.com/oembed");
  });

  it("falls back to the plain image when the video URL isn't a Wistia link", () => {
    const { container, queryByLabelText } = render(
      <BlockDsoSplitFeature
        props={props({ imageUrl: "https://cdn.example.com/thumb.jpg", videoUrl: "https://youtube.com/watch?v=nope" })}
        brand={BRAND}
      />,
    );
    expect(container.querySelector("img")).toBeTruthy();
    expect(container.querySelector("iframe")).toBeNull();
    expect(queryByLabelText("Play video")).toBeNull();
  });
});
