import { describe, it, expect } from "vitest";
import { extractPerformanceScore, getMeasuredSpeedScore, __clearSpeedScoreCache } from "./pageSpeedInsights";

describe("extractPerformanceScore", () => {
  it("maps a Lighthouse 0-1 performance score to 0-100", () => {
    expect(extractPerformanceScore({ lighthouseResult: { categories: { performance: { score: 0.87 } } } })).toBe(87);
    expect(extractPerformanceScore({ lighthouseResult: { categories: { performance: { score: 1 } } } })).toBe(100);
    expect(extractPerformanceScore({ lighthouseResult: { categories: { performance: { score: 0 } } } })).toBe(0);
  });

  it("returns null for malformed or missing payloads", () => {
    expect(extractPerformanceScore(null)).toBeNull();
    expect(extractPerformanceScore({})).toBeNull();
    expect(extractPerformanceScore({ lighthouseResult: {} })).toBeNull();
    expect(extractPerformanceScore({ lighthouseResult: { categories: {} } })).toBeNull();
    expect(extractPerformanceScore({ lighthouseResult: { categories: { performance: { score: null } } } })).toBeNull();
    expect(extractPerformanceScore({ lighthouseResult: { categories: { performance: {} } } })).toBeNull();
  });
});

describe("getMeasuredSpeedScore", () => {
  it("returns null for an unpublished (draft) page without scheduling a fetch", () => {
    __clearSpeedScoreCache();
    const score = getMeasuredSpeedScore({ id: 1, tenantId: 1, slug: "draft-page", status: "draft" });
    expect(score).toBeNull();
  });

  it("returns null when no measurement is cached yet for a published page", () => {
    __clearSpeedScoreCache();
    // In test env the background fetch is disabled, so this stays null (→ proxy).
    const score = getMeasuredSpeedScore({ id: 2, tenantId: 1, slug: "live-page", status: "published" });
    expect(score).toBeNull();
  });
});
