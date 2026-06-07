/**
 * Unit tests for the data-driven GENERAL block library.
 *
 * `buildGeneralSystemPrompt` assembles the GENERAL system prompt at request
 * time, advertising a block list that is filtered by the per-industry
 * block_catalog `ai_enabled` flag (the superadmin toggle). These tests exercise
 * the pure assembly/filtering logic — no DB, no network.
 *
 * Asserted contract:
 *   1. Fail-open: with no disabled types, the full curated library is advertised
 *      (existing blocks + the new curated blocks).
 *   2. A type in `aiDisabledTypes` is dropped from the advertised list, whether
 *      it is an existing block or one of the new curated blocks.
 *   3. The full-page blocks (`content-series`, `blog-series`, `storefront`) are
 *      advertised ONLY when their respective include flag is set, and the
 *      matching `is*Request` keyword detector drives that flag.
 */
import { describe, it, expect } from "vitest";
import {
  buildGeneralSystemPrompt,
  isContentSeriesRequest,
  isBlogSeriesRequest,
  isStorefrontRequest,
  isSingleFullPageBlock,
} from "./generate-page";

/** Every block schema bullet looks like `- "type": …`; collect the types. */
function advertisedTypes(prompt: string): string[] {
  const types: string[] = [];
  for (const line of prompt.split("\n")) {
    const m = line.match(/^- "([a-z0-9-]+)":/);
    if (m) types.push(m[1]);
  }
  return types;
}

describe("buildGeneralSystemPrompt — fail-open full library", () => {
  it("advertises the existing and curated blocks when nothing is disabled", () => {
    const prompt = buildGeneralSystemPrompt();
    const types = advertisedTypes(prompt);
    // Existing core + showcase blocks.
    for (const t of ["hero", "benefits-grid", "comparison", "magazine-hero", "bento-showcase"]) {
      expect(types).toContain(t);
    }
    // New curated blocks.
    for (const t of [
      "nav-header", "footer", "case-studies", "product-showcase",
      "roi-calculator", "story-hub", "resources", "scroll-assembly",
      "dso-heartland-hero",
    ]) {
      expect(types).toContain(t);
    }
  });

  it("treats an empty disabled set the same as no options (fail-open)", () => {
    const a = buildGeneralSystemPrompt();
    const b = buildGeneralSystemPrompt({ aiDisabledTypes: new Set() });
    expect(a).toBe(b);
  });
});

describe("buildGeneralSystemPrompt — ai_enabled filtering", () => {
  it("drops a disabled existing block from the advertised list", () => {
    const prompt = buildGeneralSystemPrompt({ aiDisabledTypes: new Set(["comparison"]) });
    const types = advertisedTypes(prompt);
    expect(types).not.toContain("comparison");
    // Other blocks remain.
    expect(types).toContain("hero");
    expect(types).toContain("benefits-grid");
  });

  it("drops a disabled curated block from the advertised list", () => {
    const prompt = buildGeneralSystemPrompt({ aiDisabledTypes: new Set(["dso-heartland-hero", "footer"]) });
    const types = advertisedTypes(prompt);
    expect(types).not.toContain("dso-heartland-hero");
    expect(types).not.toContain("footer");
    expect(types).toContain("nav-header");
  });
});

describe("buildGeneralSystemPrompt — content-series conditional", () => {
  it("omits content-series by default", () => {
    const types = advertisedTypes(buildGeneralSystemPrompt());
    expect(types).not.toContain("content-series");
  });

  it("advertises content-series only when includeContentSeries is set", () => {
    const types = advertisedTypes(buildGeneralSystemPrompt({ includeContentSeries: true }));
    expect(types).toContain("content-series");
  });

  it("still respects ai_enabled filtering for content-series", () => {
    const types = advertisedTypes(buildGeneralSystemPrompt({
      includeContentSeries: true,
      aiDisabledTypes: new Set(["content-series"]),
    }));
    expect(types).not.toContain("content-series");
  });
});

describe("isContentSeriesRequest", () => {
  it("detects podcast / webinar / series requests", () => {
    expect(isContentSeriesRequest("Build a landing page for our weekly podcast")).toBe(true);
    expect(isContentSeriesRequest("A page for our upcoming WEBINAR series")).toBe(true);
    expect(isContentSeriesRequest("Episode hub with listen now buttons")).toBe(true);
  });

  it("returns false for ordinary product / marketing requests", () => {
    expect(isContentSeriesRequest("A SaaS pricing page for our analytics tool")).toBe(false);
    expect(isContentSeriesRequest("")).toBe(false);
    expect(isContentSeriesRequest(undefined as unknown as string)).toBe(false);
  });
});

describe("buildGeneralSystemPrompt — blog-series conditional", () => {
  it("omits blog-series by default", () => {
    expect(advertisedTypes(buildGeneralSystemPrompt())).not.toContain("blog-series");
  });

  it("advertises blog-series only when includeBlogSeries is set", () => {
    const types = advertisedTypes(buildGeneralSystemPrompt({ includeBlogSeries: true }));
    expect(types).toContain("blog-series");
  });

  it("still respects ai_enabled filtering for blog-series", () => {
    const types = advertisedTypes(buildGeneralSystemPrompt({
      includeBlogSeries: true,
      aiDisabledTypes: new Set(["blog-series"]),
    }));
    expect(types).not.toContain("blog-series");
  });
});

describe("buildGeneralSystemPrompt — storefront conditional", () => {
  it("omits storefront by default", () => {
    expect(advertisedTypes(buildGeneralSystemPrompt())).not.toContain("storefront");
  });

  it("advertises storefront only when includeStorefront is set", () => {
    const types = advertisedTypes(buildGeneralSystemPrompt({ includeStorefront: true }));
    expect(types).toContain("storefront");
  });

  it("still respects ai_enabled filtering for storefront", () => {
    const types = advertisedTypes(buildGeneralSystemPrompt({
      includeStorefront: true,
      aiDisabledTypes: new Set(["storefront"]),
    }));
    expect(types).not.toContain("storefront");
  });
});

describe("isBlogSeriesRequest", () => {
  it("detects blog / editorial / essay-series requests", () => {
    expect(isBlogSeriesRequest("A page for our company blog")).toBe(true);
    expect(isBlogSeriesRequest("An EDITORIAL home for our essay series")).toBe(true);
    expect(isBlogSeriesRequest("A long-form magazine publication")).toBe(true);
  });

  it("returns false for ordinary product / marketing requests", () => {
    expect(isBlogSeriesRequest("A SaaS pricing page for our analytics tool")).toBe(false);
    expect(isBlogSeriesRequest("")).toBe(false);
    expect(isBlogSeriesRequest(undefined as unknown as string)).toBe(false);
  });
});

describe("isStorefrontRequest", () => {
  it("detects ecommerce / online-store requests", () => {
    expect(isStorefrontRequest("Build an online store for our coffee brand")).toBe(true);
    expect(isStorefrontRequest("A DTC ECOMMERCE shop page with add to cart")).toBe(true);
    expect(isStorefrontRequest("A product catalog with checkout")).toBe(true);
  });

  it("returns false for ordinary B2B / marketing requests", () => {
    expect(isStorefrontRequest("A SaaS pricing page for our analytics tool")).toBe(false);
    expect(isStorefrontRequest("")).toBe(false);
    expect(isStorefrontRequest(undefined as unknown as string)).toBe(false);
  });
});

describe("isSingleFullPageBlock", () => {
  it("is true for a page that is a single self-contained full-page block", () => {
    // These render their OWN nav AND footer, so the generator must not stack
    // any chrome on top: content/blog/storefront plus the bespoke event and
    // case-study full-page templates.
    for (const type of [
      "content-series", "blog-series", "storefront",
      "event-noir", "event-luminous", "event-split",
      "case-metrics", "case-editorial", "case-modular",
    ]) {
      expect(isSingleFullPageBlock([{ type }])).toBe(true);
    }
  });

  it("is false when the full-page block is combined with other blocks", () => {
    expect(isSingleFullPageBlock([{ type: "storefront" }, { type: "footer" }])).toBe(false);
    expect(isSingleFullPageBlock([{ type: "nav-header" }, { type: "content-series" }])).toBe(false);
  });

  it("is false for a single block that is NOT a self-contained full-page block", () => {
    // event-page / business-case-* render their own nav but no footer, so they
    // are intentionally NOT treated as self-contained here — they still need a
    // footer injected (business-case-* skip only the nav via SELF_NAV_TYPES).
    for (const type of [
      "hero", "full-bleed-hero", "event-page",
      "business-case-split", "business-case-centered", "business-case-premium",
    ]) {
      expect(isSingleFullPageBlock([{ type }])).toBe(false);
    }
  });

  it("is false for an empty page or malformed block entries", () => {
    expect(isSingleFullPageBlock([])).toBe(false);
    expect(isSingleFullPageBlock([{}])).toBe(false);
    expect(isSingleFullPageBlock([{ type: 42 as unknown }])).toBe(false);
  });
});
