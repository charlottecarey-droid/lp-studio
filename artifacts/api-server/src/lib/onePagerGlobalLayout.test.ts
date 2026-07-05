// Pins the LAYOUT-ONLY contract for global one-pager layout defaults: content
// keys authored under the operator's brand (copy, stats, images, links) are
// stripped before a global row reaches any tenant-facing consumer, while
// layout knobs (spacing, sizes, offsets, toggles) survive.
import { describe, it, expect } from "vitest";
import { stripContentFromGlobalLayoutConfig } from "./onePagerGlobalLayout";

describe("stripContentFromGlobalLayoutConfig", () => {
  it("drops top-level content keys and keeps layout knobs", () => {
    const out = stripContentFromGlobalLayoutConfig({
      partnerHeadline: "Operator headline",
      partnerStats: [{ value: "88%", desc: "operator survey" }],
      comparisonRows: [{ capability: "x", then: "a", now: "b" }],
      audienceContent: { executive: {} },
      teamCfg: { show: true, headingFontSize: 14, nameFontSize: 11 },
    });
    expect(out).toEqual({ teamCfg: { show: true, headingFontSize: 14, nameFontSize: 11 } });
  });

  it("strips nested content inside headerCfg/bodyCfg/footerCfg but keeps their layout fields", () => {
    const out = stripContentFromGlobalLayoutConfig({
      headerCfg: { height: 180, boldHeading: false, titleText: "Operator title", headerImage: "data:...", logoGroupOffsetX: 4 },
      bodyCfg: { sectionSpacing: 20, headlineText: "Operator headline", quoteText: "Operator quote" },
      footerCfg: { fontSize: 9, show: true, link: "operator.example.com", height: 40 },
    });
    expect(out).toEqual({
      headerCfg: { height: 180, boldHeading: false, logoGroupOffsetX: 4 },
      bodyCfg: { sectionSpacing: 20 },
      footerCfg: { fontSize: 9, show: true, height: 40 },
    });
  });

  it("strips the agreement summary's flat content fields, keeps its layout fields", () => {
    const out = stripContentFromGlobalLayoutConfig({
      headline: "Summary of Operator Agreement",
      subheadline: "operator sub",
      sections: [{ label: "Terms" }],
      footerContacts: [{ name: "Op" }],
      footerLinkText: "op",
      footerLinkUrl: "https://op.example",
      headerImage: "https://op.example/scanner.png",
      headlineFontSize: 46,
      sectionRowGap: 18,
      showSectionDividers: false,
    });
    expect(out).toEqual({ headlineFontSize: 46, sectionRowGap: 18, showSectionDividers: false });
  });

  it("returns non-object inputs unchanged", () => {
    expect(stripContentFromGlobalLayoutConfig(null)).toBeNull();
    expect(stripContentFromGlobalLayoutConfig([1])).toEqual([1]);
    expect(stripContentFromGlobalLayoutConfig("x")).toBe("x");
  });
});
