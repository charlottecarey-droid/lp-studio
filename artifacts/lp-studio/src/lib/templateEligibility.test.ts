import { describe, it, expect } from "vitest";
import {
  FUNNEL_STAGE_OPTIONS,
  funnelStageLabel,
  isFunnelStage,
  normalizeFunnelStages,
  formatEligibilitySummary,
  normalizeTemplateAiBehavior,
  DEFAULT_TEMPLATE_AI_BEHAVIOR,
  AI_BEHAVIOR_OPTIONS,
} from "./templateEligibility";

describe("funnel stage label ↔ value map", () => {
  it("maps every canonical value to a non-empty label", () => {
    for (const o of FUNNEL_STAGE_OPTIONS) {
      expect(funnelStageLabel(o.value)).toBe(o.label);
      expect(o.label.length).toBeGreaterThan(0);
    }
  });

  it("recognizes only the canonical backend values", () => {
    expect(isFunnelStage("first-meeting")).toBe(true);
    expect(isFunnelStage("deal-acceleration")).toBe(true);
    expect(isFunnelStage("onboarding")).toBe(true);
    expect(isFunnelStage("expansion-renewal")).toBe(true);
    expect(isFunnelStage("renewal")).toBe(false);
    expect(isFunnelStage("")).toBe(false);
    expect(isFunnelStage(null)).toBe(false);
    expect(isFunnelStage(undefined)).toBe(false);
  });

  it("title-cases an unknown value rather than rendering empty", () => {
    expect(funnelStageLabel("legacy-stage")).toBe("Legacy Stage");
    expect(funnelStageLabel("")).toBe("");
    expect(funnelStageLabel(null)).toBe("");
  });

  it("normalizes stages to canonical order, dedupes, drops invalid", () => {
    expect(
      normalizeFunnelStages(["expansion-renewal", "first-meeting", "first-meeting", "bogus"]),
    ).toEqual(["first-meeting", "expansion-renewal"]);
    expect(normalizeFunnelStages(null)).toEqual([]);
    expect(normalizeFunnelStages([])).toEqual([]);
  });
});

describe("formatEligibilitySummary", () => {
  it("renders fully-wildcard eligibility as 'Any audience or stage'", () => {
    expect(
      formatEligibilitySummary({
        eligibleSegments: [],
        eligiblePersonas: [],
        eligibleFunnelStages: [],
        funnelStage: null,
      }),
    ).toBe("Any audience or stage");
  });

  it("fills empty axes with 'Any …' and resolves names", () => {
    const summary = formatEligibilitySummary(
      {
        eligibleSegments: ["seg-dso", "seg-grp"],
        eligiblePersonas: [],
        eligibleFunnelStages: ["expansion-renewal"],
        funnelStage: "expansion-renewal",
      },
      { "seg-dso": "DSO", "seg-grp": "Group Practice" },
    );
    expect(summary).toBe("DSO, Group Practice · Any persona · Renewal / Expansion");
  });

  it("falls back to the raw id when a name is unknown", () => {
    const summary = formatEligibilitySummary(
      {
        eligibleSegments: ["seg-x"],
        eligiblePersonas: ["persona-exec"],
        eligibleFunnelStages: [],
        funnelStage: null,
      },
      {},
      { "persona-exec": "Executive" },
    );
    expect(summary).toBe("seg-x · Executive · Any stage");
  });

  it("ignores invalid funnel stages in the summary", () => {
    const summary = formatEligibilitySummary({
      eligibleSegments: [],
      eligiblePersonas: [],
      eligibleFunnelStages: ["bogus"],
      funnelStage: null,
    });
    // "bogus" is dropped → fully wildcard again.
    expect(summary).toBe("Any audience or stage");
  });
});

describe("AI behavior governance", () => {
  it("defaults to the safe ai-from-scratch-only", () => {
    expect(DEFAULT_TEMPLATE_AI_BEHAVIOR).toBe("ai-from-scratch-only");
    expect(normalizeTemplateAiBehavior(undefined)).toBe("ai-from-scratch-only");
    expect(normalizeTemplateAiBehavior("nonsense")).toBe("ai-from-scratch-only");
    expect(normalizeTemplateAiBehavior(null)).toBe("ai-from-scratch-only");
  });

  it("passes through valid behaviors", () => {
    expect(normalizeTemplateAiBehavior("template-required")).toBe("template-required");
    expect(normalizeTemplateAiBehavior("template-preferred")).toBe("template-preferred");
    expect(normalizeTemplateAiBehavior("ai-from-scratch-only")).toBe("ai-from-scratch-only");
  });

  it("exposes the default as the recommended option", () => {
    const recommended = AI_BEHAVIOR_OPTIONS.filter((o) => o.recommended);
    expect(recommended).toHaveLength(1);
    expect(recommended[0].value).toBe(DEFAULT_TEMPLATE_AI_BEHAVIOR);
  });
});
