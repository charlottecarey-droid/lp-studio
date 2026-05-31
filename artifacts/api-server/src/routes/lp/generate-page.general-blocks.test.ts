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
 *   3. The full-page `content-series` block is advertised ONLY when
 *      `includeContentSeries` is set, and `isContentSeriesRequest` drives that.
 */
import { describe, it, expect } from "vitest";
import { buildGeneralSystemPrompt, isContentSeriesRequest } from "./generate-page";

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
