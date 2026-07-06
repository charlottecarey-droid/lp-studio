// Layout-region probe contract for the shared one-pager generators.
//
// The template editor's drag-on-preview handles are positioned from the
// `regions` collector each generator fills at draw time (opts.regions). Two
// guarantees keep the drag UX honest:
//
//   1. Every template reports its draggable regions (and the page rect used
//      to scale them), with sane in-page geometry.
//   2. A region tracks its offset knob 1:1 — nudging logoGroupOffsetX by
//      N pt moves regions.logoGroup.x by exactly N pt. The editor relies on
//      this to translate drag deltas into knob values without feedback drift.
//
// Passing no collector must stay a no-op (the rep page and web one-pager
// never pass one), which is implicitly covered by every other generator test.

import { describe, it, expect } from "vitest";
import {
  generateAgreementSummaryOnePager,
  generatePilotOnePager,
  generateComparisonOnePager,
  generateNewPartnerOnePager,
  generateROIOnePager,
  defaultAudienceContent,
  defaultAgreementSummaryContent,
  type BrandContext,
  type OnePagerRegions,
} from "@workspace/one-pager-types/generators";

const BRAND: BrandContext = {
  wordmark: "royal",
  productName: "Royal",
  industryLabel: "Group",
  labName: "Royal",
  footerUrl: "royal.example.com",
  qrFallbackUrl: "https://royal.example.com",
  agreementName: "Royal Practice Agreement",
  agreementUrl: "https://royal.example.com/agreement",
};

const PAGE_W = 612;
const PAGE_H = 792;

function expectSaneRegion(regions: OnePagerRegions, key: string): void {
  const r = regions[key];
  expect(r, `region "${key}" should be reported`).toBeDefined();
  expect(r.w).toBeGreaterThan(0);
  expect(r.h).toBeGreaterThan(0);
  // Regions live on the page (allow a small bleed for approximate boxes).
  expect(r.x).toBeGreaterThan(-PAGE_W * 0.2);
  expect(r.y).toBeGreaterThan(-PAGE_H * 0.2);
  expect(r.x + r.w).toBeLessThan(PAGE_W * 1.2);
  expect(r.y + r.h).toBeLessThan(PAGE_H * 1.2);
}

type Gen = (headerCfg: Record<string, unknown>, regions: OnePagerRegions) => Promise<unknown>;

// Each entry: how to run the generator with a headerCfg override + collector,
// which regions it must report, and which knob drives which region axis.
const HEADER_TEMPLATES: Array<{ name: string; run: Gen; hasSubtitle: "y" | "xy" | false }> = [
  {
    name: "pilot",
    run: (headerCfg, regions) =>
      generatePilotOnePager("Royal Group", "executive", [], "", null, { w: 0, h: 0 },
        defaultAudienceContent.executive, undefined, undefined,
        { brand: BRAND, regions, layoutOverrides: { headerCfg } }),
    hasSubtitle: "y",
  },
  {
    name: "comparison",
    run: (headerCfg, regions) =>
      generateComparisonOnePager("Royal Group", [], "", null, { w: 0, h: 0 }, undefined, undefined,
        { brand: BRAND, regions, layoutOverrides: { headerCfg } }),
    hasSubtitle: "y",
  },
  {
    name: "new-partner",
    run: (headerCfg, regions) =>
      generateNewPartnerOnePager("Royal Group", null, { w: 0, h: 0 }, "https://royal.example.com", undefined,
        { brand: BRAND, regions, layoutOverrides: { headerCfg } }),
    hasSubtitle: "xy",
  },
  {
    name: "roi",
    run: (headerCfg, regions) =>
      generateROIOnePager("Royal Group", 50, { brand: BRAND, regions, layoutOverrides: { headerCfg } }),
    hasSubtitle: false,
  },
];

describe("one-pager layout-region probes", () => {
  for (const t of HEADER_TEMPLATES) {
    it(`${t.name}: reports page/logoGroup/headline regions that track their offset knobs`, async () => {
      const base: OnePagerRegions = {};
      await t.run({}, base);
      expect(base.page).toMatchObject({ x: 0, y: 0, w: PAGE_W, h: PAGE_H });
      expectSaneRegion(base, "logoGroup");
      expectSaneRegion(base, "headline");
      if (t.hasSubtitle) expectSaneRegion(base, "subtitle");

      const nudged: OnePagerRegions = {};
      await t.run(
        { logoGroupOffsetX: 40, logoGroupOffsetY: 20, headingOffsetX: -30, subtitleOffsetY: 15 },
        nudged,
      );
      expect(nudged.logoGroup.x - base.logoGroup.x).toBeCloseTo(40, 5);
      expect(nudged.logoGroup.y - base.logoGroup.y).toBeCloseTo(20, 5);
      expect(nudged.headline.x - base.headline.x).toBeCloseTo(-30, 5);
      if (t.hasSubtitle === "y") {
        expect(nudged.subtitle.y - base.subtitle.y).toBeCloseTo(15, 5);
      }
    }, 30_000);
  }

  it("new-partner: the subtitle line tracks subtitleOffsetX / subtitleLineOffsetY", async () => {
    const base: OnePagerRegions = {};
    const run = HEADER_TEMPLATES.find(t => t.name === "new-partner")!.run;
    await run({}, base);
    const nudged: OnePagerRegions = {};
    await run({ subtitleOffsetX: 25, subtitleLineOffsetY: -10 }, nudged);
    expect(nudged.subtitle.x - base.subtitle.x).toBeCloseTo(25, 5);
    expect(nudged.subtitle.y - base.subtitle.y).toBeCloseTo(-10, 5);
  }, 30_000);

  it("agreement-summary: reports all four regions and they track their knobs", async () => {
    const base: OnePagerRegions = {};
    await generateAgreementSummaryOnePager(defaultAgreementSummaryContent, { brand: BRAND, regions: base });
    expect(base.page).toMatchObject({ x: 0, y: 0, w: PAGE_W, h: PAGE_H });
    for (const key of ["logoGroup", "headline", "subheadline", "sections"]) expectSaneRegion(base, key);

    const nudged: OnePagerRegions = {};
    await generateAgreementSummaryOnePager(
      {
        ...defaultAgreementSummaryContent,
        logoGroupOffsetX: 30, logoGroupOffsetY: -15,
        headlineOffsetX: 20, headlineOffsetY: 25,
        subheadlineOffsetX: 12, subheadlineOffsetY: 8,
        sectionsOffsetY: 40,
      },
      { brand: BRAND, regions: nudged },
    );
    expect(nudged.logoGroup.x - base.logoGroup.x).toBeCloseTo(30, 5);
    expect(nudged.logoGroup.y - base.logoGroup.y).toBeCloseTo(-15, 5);
    expect(nudged.headline.x - base.headline.x).toBeCloseTo(20, 5);
    expect(nudged.headline.y - base.headline.y).toBeCloseTo(25, 5);
    expect(nudged.subheadline.x - base.subheadline.x).toBeCloseTo(12, 5);
    // The subheadline's Y also rides the headline block (it anchors below
    // headlineBottom), so its delta is the sum of both Y nudges.
    expect(nudged.subheadline.y - base.subheadline.y).toBeCloseTo(8 + 25, 5);
    expect(nudged.sections.y - base.sections.y).toBeCloseTo(40, 5);
  }, 30_000);
});
