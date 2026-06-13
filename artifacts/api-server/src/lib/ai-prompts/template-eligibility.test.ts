/**
 * Template eligibility engine — pure-function tests.
 *
 * Covers: wildcard matches any; explicit declared match beats wildcard on
 * confidence; persona optional; the eligibility rule per axis; and the three
 * aiBehavior modes (ai-from-scratch-only always null; template-preferred
 * threshold + none→scratch; template-required best-eligible + none→scratch).
 */
import { describe, it, expect } from "vitest";
import {
  selectEligibleTemplate,
  effectiveEligibleFunnelStages,
  normalizeTemplateAiBehavior,
  DEFAULT_TEMPLATE_AI_BEHAVIOR,
  MIN_AUTO_RECOMMEND_CONFIDENCE,
  type EligibilityCandidate,
} from "./template-eligibility";

// ── Fixtures ────────────────────────────────────────────────────────────────
const WILDCARD: EligibilityCandidate = {
  slug: "global-wildcard",
  label: "Wildcard Template",
  // nothing declared on any axis → ANY context
};

const RENEWAL_EXEC_DSO: EligibilityCandidate = {
  slug: "global-value-renewal-review",
  label: "Value & Renewal Review",
  eligibleSegments: ["DSO"],
  eligiblePersonas: ["Executive"],
  eligibleFunnelStages: ["renewal", "expansion-renewal"],
  funnelStage: "expansion-renewal",
};

const FIRST_MEETING_ONLY: EligibilityCandidate = {
  slug: "global-first-meeting",
  label: "First Meeting",
  // only the singular primary stage known → eligible set defaults to it
  funnelStage: "first-meeting",
};

describe("normalizeTemplateAiBehavior", () => {
  it("defaults to ai-from-scratch-only (owner's safe default)", () => {
    expect(DEFAULT_TEMPLATE_AI_BEHAVIOR).toBe("ai-from-scratch-only");
    expect(normalizeTemplateAiBehavior(undefined)).toBe("ai-from-scratch-only");
    expect(normalizeTemplateAiBehavior("garbage")).toBe("ai-from-scratch-only");
    expect(normalizeTemplateAiBehavior(null)).toBe("ai-from-scratch-only");
  });
  it("passes through valid values", () => {
    expect(normalizeTemplateAiBehavior("template-required")).toBe("template-required");
    expect(normalizeTemplateAiBehavior("template-preferred")).toBe("template-preferred");
    expect(normalizeTemplateAiBehavior("ai-from-scratch-only")).toBe("ai-from-scratch-only");
  });
});

describe("effectiveEligibleFunnelStages", () => {
  it("uses the declared set when present", () => {
    expect(effectiveEligibleFunnelStages(RENEWAL_EXEC_DSO)).toEqual(["renewal", "expansion-renewal"]);
  });
  it("defaults to [funnelStage] when only the singular primary is known", () => {
    expect(effectiveEligibleFunnelStages(FIRST_MEETING_ONLY)).toEqual(["first-meeting"]);
  });
  it("is a wildcard ([]) when neither is set", () => {
    expect(effectiveEligibleFunnelStages(WILDCARD)).toEqual([]);
  });
});

describe("selectEligibleTemplate — eligibility rule", () => {
  it("wildcard template is eligible for ANY context", () => {
    const r = selectEligibleTemplate(
      { segment: "Anything", persona: "Anyone", funnelStage: "any-stage" },
      [WILDCARD],
      "template-preferred",
    );
    expect(r.eligible.map((e) => e.slug)).toContain("global-wildcard");
  });

  it("explicit segment mismatch makes a declared template ineligible", () => {
    const r = selectEligibleTemplate(
      { segment: "Independent", funnelStage: "renewal", persona: "Executive" },
      [RENEWAL_EXEC_DSO],
      "template-required",
    );
    expect(r.eligible).toHaveLength(0);
    expect(r.fromScratch).toBe(true);
    expect(r.recommendedSlug).toBeNull();
  });

  it("explicit funnel-stage mismatch makes a declared template ineligible", () => {
    const r = selectEligibleTemplate(
      { segment: "DSO", funnelStage: "first-meeting", persona: "Executive" },
      [RENEWAL_EXEC_DSO],
      "template-required",
    );
    expect(r.eligible).toHaveLength(0);
  });

  it("a template declaring a segment is NOT eligible when context segment is absent (required axis)", () => {
    const r = selectEligibleTemplate(
      { funnelStage: "renewal" }, // no segment
      [RENEWAL_EXEC_DSO],
      "template-required",
    );
    expect(r.eligible).toHaveLength(0);
  });

  it("matches funnel via the [funnelStage] default when eligibleFunnelStages unset", () => {
    const r = selectEligibleTemplate(
      { funnelStage: "first-meeting" },
      [FIRST_MEETING_ONLY],
      "template-preferred",
    );
    expect(r.eligible.map((e) => e.slug)).toContain("global-first-meeting");
  });
});

describe("selectEligibleTemplate — persona is optional", () => {
  it("a template declaring a persona is STILL eligible when persona context is absent", () => {
    const r = selectEligibleTemplate(
      { segment: "DSO", funnelStage: "renewal" }, // no persona supplied
      [RENEWAL_EXEC_DSO],
      "template-required",
    );
    expect(r.eligible.map((e) => e.slug)).toContain("global-value-renewal-review");
  });

  it("a declared persona mismatch DOES make it ineligible when persona is supplied", () => {
    const r = selectEligibleTemplate(
      { segment: "DSO", funnelStage: "renewal", persona: "Office Manager" },
      [RENEWAL_EXEC_DSO],
      "template-required",
    );
    expect(r.eligible).toHaveLength(0);
  });
});

describe("selectEligibleTemplate — confidence: explicit beats wildcard", () => {
  it("an explicitly-DSO-renewal-exec template outranks a wildcard for a DSO renewal exec context", () => {
    const r = selectEligibleTemplate(
      { segment: "DSO", persona: "Executive", funnelStage: "renewal" },
      [WILDCARD, RENEWAL_EXEC_DSO],
      "template-preferred",
    );
    expect(r.eligible).toHaveLength(2);
    expect(r.eligible[0].slug).toBe("global-value-renewal-review"); // explicit ranks first
    expect(r.eligible[0].confidence).toBeGreaterThan(r.eligible[1].confidence);
    expect(r.recommendedSlug).toBe("global-value-renewal-review");
    expect(r.fromScratch).toBe(false);
  });

  it("a fully-explicit match reaches confidence 1.0; wildcard stays low", () => {
    const r = selectEligibleTemplate(
      { segment: "DSO", persona: "Executive", funnelStage: "renewal" },
      [WILDCARD, RENEWAL_EXEC_DSO],
      "template-preferred",
    );
    const explicit = r.eligible.find((e) => e.slug === "global-value-renewal-review")!;
    const wild = r.eligible.find((e) => e.slug === "global-wildcard")!;
    expect(explicit.confidence).toBeCloseTo(1, 5);
    expect(wild.confidence).toBeLessThan(MIN_AUTO_RECOMMEND_CONFIDENCE);
  });
});

describe("selectEligibleTemplate — aiBehavior: ai-from-scratch-only", () => {
  it("ALWAYS returns recommendedSlug null + fromScratch true, even with a perfect eligible match", () => {
    const r = selectEligibleTemplate(
      { segment: "DSO", persona: "Executive", funnelStage: "renewal" },
      [RENEWAL_EXEC_DSO],
      "ai-from-scratch-only",
    );
    expect(r.recommendedSlug).toBeNull();
    expect(r.fromScratch).toBe(true);
    // still surfaces what WOULD be eligible for the UI
    expect(r.eligible.map((e) => e.slug)).toContain("global-value-renewal-review");
    expect(r.reasoning.join(" ")).toMatch(/governance/i);
  });
});

describe("selectEligibleTemplate — aiBehavior: template-preferred", () => {
  it("recommends the highest-confidence eligible template above threshold", () => {
    const r = selectEligibleTemplate(
      { segment: "DSO", persona: "Executive", funnelStage: "renewal" },
      [RENEWAL_EXEC_DSO],
      "template-preferred",
    );
    expect(r.recommendedSlug).toBe("global-value-renewal-review");
    expect(r.fromScratch).toBe(false);
  });

  it("falls back to from-scratch when the only eligible match is wildcard (below threshold)", () => {
    const r = selectEligibleTemplate(
      { segment: "DSO", persona: "Executive", funnelStage: "renewal" },
      [WILDCARD],
      "template-preferred",
    );
    expect(r.eligible.map((e) => e.slug)).toContain("global-wildcard");
    expect(r.recommendedSlug).toBeNull();
    expect(r.fromScratch).toBe(true);
  });

  it("falls back to from-scratch when NOTHING is eligible", () => {
    const r = selectEligibleTemplate(
      { segment: "Independent", funnelStage: "renewal" },
      [RENEWAL_EXEC_DSO],
      "template-preferred",
    );
    expect(r.recommendedSlug).toBeNull();
    expect(r.fromScratch).toBe(true);
  });
});

describe("selectEligibleTemplate — aiBehavior: template-required", () => {
  it("recommends the best eligible template even below the preferred threshold (wildcard ok)", () => {
    const r = selectEligibleTemplate(
      { segment: "DSO", funnelStage: "renewal" },
      [WILDCARD],
      "template-required",
    );
    expect(r.recommendedSlug).toBe("global-wildcard");
    expect(r.fromScratch).toBe(false);
  });

  it("STILL falls back to from-scratch (safer than wrong) when none is eligible, with a reasoning flag", () => {
    const r = selectEligibleTemplate(
      { segment: "Independent", funnelStage: "first-meeting" },
      [RENEWAL_EXEC_DSO],
      "template-required",
    );
    expect(r.eligible).toHaveLength(0);
    expect(r.recommendedSlug).toBeNull();
    expect(r.fromScratch).toBe(true);
    expect(r.reasoning.join(" ")).toMatch(/no eligible template exists/i);
  });
});

describe("selectEligibleTemplate — reasoning trail", () => {
  it("renders human-readable segment / funnel / persona lines + the decision", () => {
    const r = selectEligibleTemplate(
      { segment: "DSO", persona: "Executive", funnelStage: "renewal" },
      [RENEWAL_EXEC_DSO],
      "template-preferred",
    );
    expect(r.reasoning).toContain("Segment = DSO");
    expect(r.reasoning).toContain("Funnel = renewal");
    expect(r.reasoning).toContain("Persona = Executive");
    expect(r.reasoning.some((line) => /→ eligible:/i.test(line))).toBe(true);
  });
});

describe("selectEligibleTemplate — determinism + tie-break", () => {
  it("breaks confidence ties deterministically by slug", () => {
    const a: EligibilityCandidate = { slug: "global-b", funnelStage: "first-meeting" };
    const b: EligibilityCandidate = { slug: "global-a", funnelStage: "first-meeting" };
    const r = selectEligibleTemplate({ funnelStage: "first-meeting" }, [a, b], "template-required");
    expect(r.eligible.map((e) => e.slug)).toEqual(["global-a", "global-b"]);
  });
});
