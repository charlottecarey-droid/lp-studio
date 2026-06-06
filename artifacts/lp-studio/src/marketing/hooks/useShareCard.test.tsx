// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, render, waitFor, cleanup } from "@testing-library/react";

import { useShareCard, type ShareCardConfig } from "./useShareCard";
import { usePageMeta } from "./usePageMeta";

const DEFAULTS: ShareCardConfig = {
  title: "Features — default title",
  description: "Default description.",
  imageUrl: "https://lpstudio.ai/opengraph.jpg",
};

beforeEach(() => {
  delete (window as { __LP_PAGE_OG__?: unknown }).__LP_PAGE_OG__;
  // Default: runtime fetch never resolves to data, so the initial (global or
  // default) value is what each test observes unless it opts into a fetch.
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve({ ok: false, json: () => Promise.resolve(null) } as Response)),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  cleanup();
});

describe("useShareCard — window.__LP_PAGE_OG__ read (prerender-injected global)", () => {
  it("reads the configured row for its page key as the initial value", () => {
    window.__LP_PAGE_OG__ = {
      features: { title: "Configured title", description: "Configured desc", imageUrl: "https://cdn.example.com/x.jpg" },
    };
    const { result } = renderHook(() => useShareCard("features", DEFAULTS));
    expect(result.current).toEqual({
      title: "Configured title",
      description: "Configured desc",
      imageUrl: "https://cdn.example.com/x.jpg",
    });
  });

  it("only reads its own page key, ignoring other pages' rows", () => {
    window.__LP_PAGE_OG__ = {
      pricing: { title: "Pricing title", description: "p", imageUrl: "" },
    };
    const { result } = renderHook(() => useShareCard("features", DEFAULTS));
    // No "features" row → built-in defaults.
    expect(result.current).toEqual(DEFAULTS);
  });
});

describe("useShareCard — field-by-field default fallback", () => {
  it("falls back to defaults when no global is present", () => {
    const { result } = renderHook(() => useShareCard("features", DEFAULTS));
    expect(result.current).toEqual(DEFAULTS);
  });

  it("falls back per field for empty/whitespace values", () => {
    window.__LP_PAGE_OG__ = {
      features: { title: "  ", description: "Real description", imageUrl: "" },
    };
    const { result } = renderHook(() => useShareCard("features", DEFAULTS));
    expect(result.current).toEqual({
      title: DEFAULTS.title, // blank → default
      description: "Real description", // kept
      imageUrl: DEFAULTS.imageUrl, // blank → default
    });
  });
});

describe("useShareCard — absolute-URL normalization for og:image", () => {
  function imageFor(raw: string): string {
    window.__LP_PAGE_OG__ = { features: { title: "t", description: "d", imageUrl: raw } };
    const { result } = renderHook(() => useShareCard("features", DEFAULTS));
    return result.current.imageUrl;
  }

  it("prefixes a root-relative path with the apex domain", () => {
    expect(imageFor("/api/storage/og.jpg")).toBe("https://lpstudio.ai/api/storage/og.jpg");
  });

  it("prefixes a bare relative path with the apex domain + slash", () => {
    expect(imageFor("uploads/og.jpg")).toBe("https://lpstudio.ai/uploads/og.jpg");
  });

  it("upgrades a protocol-relative URL to https", () => {
    expect(imageFor("//cdn.example.com/og.png")).toBe("https://cdn.example.com/og.png");
  });

  it("leaves an absolute http/https URL untouched", () => {
    expect(imageFor("http://cdn.example.com/og.png")).toBe("http://cdn.example.com/og.png");
    expect(imageFor("https://cdn.example.com/og.png")).toBe("https://cdn.example.com/og.png");
  });

  it("leaves a data: URL untouched", () => {
    expect(imageFor("data:image/png;base64,AAAA")).toBe("data:image/png;base64,AAAA");
  });
});

describe("useShareCard — runtime fetch convergence", () => {
  it("overrides the initial value once /api/lp/page-og/:key resolves", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ title: "Live title", description: "Live desc", imageUrl: "/api/storage/live.jpg" }),
        } as Response),
      ),
    );
    const { result } = renderHook(() => useShareCard("features", DEFAULTS));
    // Starts from defaults (no global)...
    expect(result.current.title).toBe(DEFAULTS.title);
    // ...then converges to the fetched row, with the image normalized.
    await waitFor(() =>
      expect(result.current).toEqual({
        title: "Live title",
        description: "Live desc",
        imageUrl: "https://lpstudio.ai/api/storage/live.jpg",
      }),
    );
    expect(fetch).toHaveBeenCalledWith("/api/lp/page-og/features");
  });

  it("keeps the built-in defaults when the fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("network"))),
    );
    const { result } = renderHook(() => useShareCard("features", DEFAULTS));
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(result.current).toEqual(DEFAULTS);
  });
});

/**
 * Prerender/meta assertion: the prerender (scripts/prerender-marketing.mjs)
 * injects window.__LP_PAGE_OG__ before page scripts run, then snapshots the
 * hydrated DOM. This proves the end of that pipeline: a configured row read via
 * useShareCard and piped through usePageMeta actually bakes the operator's OG
 * tags into <head> — which is exactly the static HTML social scrapers fetch.
 */
describe("prerender baking — configured row reaches the document <head>", () => {
  function Harness() {
    const og = useShareCard("features", DEFAULTS);
    usePageMeta({
      title: og.title,
      description: og.description,
      canonical: "https://lpstudio.ai/features",
      ogImage: og.imageUrl,
      siteName: "LP Studio",
    });
    return null;
  }

  it("bakes the configured title/description/image into <head> OG tags", async () => {
    window.__LP_PAGE_OG__ = {
      features: {
        title: "Baked features title",
        description: "Baked features description.",
        imageUrl: "/api/storage/baked.jpg",
      },
    };
    render(<Harness />);

    await waitFor(() =>
      expect(document.head.querySelector('meta[property="og:title"]')?.getAttribute("content")).toBe(
        "Baked features title",
      ),
    );
    expect(document.head.querySelector('meta[property="og:description"]')?.getAttribute("content")).toBe(
      "Baked features description.",
    );
    // useShareCard normalized the relative image to absolute before baking.
    expect(document.head.querySelector('meta[property="og:image"]')?.getAttribute("content")).toBe(
      "https://lpstudio.ai/api/storage/baked.jpg",
    );
    expect(document.title).toBe("Baked features title");
  });

  it("bakes the built-in defaults when no row is configured", async () => {
    render(<Harness />);
    await waitFor(() =>
      expect(document.head.querySelector('meta[property="og:title"]')?.getAttribute("content")).toBe(DEFAULTS.title),
    );
    expect(document.head.querySelector('meta[property="og:image"]')?.getAttribute("content")).toBe(DEFAULTS.imageUrl);
  });
});
