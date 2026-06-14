/**
 * Generator-preset effective-merge — pure-function tests.
 *
 * Covers the global ∪ tenant-override ∪ tenant-own merge (disable, reorder,
 * edit, add), surface filtering ('both' + exact), and that a preset's template
 * tie feeds the EXISTING eligibility system (selectEligibleTemplate) — i.e. a
 * tie only surfaces a template when eligible, and "no tie" = AI from scratch.
 */
import { describe, it, expect } from "vitest";
import {
  mergeEffectivePresets,
  normalizeSurface,
  surfaceMatches,
  resolvePresetTemplateTie,
  type PresetRow,
  type PresetOverrideRow,
} from "./generatorPresets";
import { selectEligibleTemplate, type EligibilityCandidate } from "./ai-prompts/template-eligibility";

// ── Fixtures ────────────────────────────────────────────────────────────────
function gPreset(over: Partial<PresetRow> & { id: number }): PresetRow {
  return {
    tenantId: null,
    surface: "marketing",
    label: `Preset ${over.id}`,
    description: null,
    icon: null,
    promptSkeleton: "skeleton",
    objective: null,
    tiedTemplateSlug: null,
    tiedTemplateIntent: null,
    enabled: true,
    sortOrder: over.id * 10,
    ...over,
  };
}
function tPreset(over: Partial<PresetRow> & { id: number; tenantId: number }): PresetRow {
  return gPreset(over);
}

describe("normalizeSurface / surfaceMatches", () => {
  it("defaults unknown surface to marketing", () => {
    expect(normalizeSurface("nonsense")).toBe("marketing");
    expect(normalizeSurface(undefined)).toBe("marketing");
    expect(normalizeSurface("sales")).toBe("sales");
    expect(normalizeSurface("both")).toBe("both");
  });
  it("'both' matches either surface; exact otherwise", () => {
    expect(surfaceMatches("both", "marketing")).toBe(true);
    expect(surfaceMatches("both", "sales")).toBe(true);
    expect(surfaceMatches("marketing", "sales")).toBe(false);
    expect(surfaceMatches("sales", "sales")).toBe(true);
  });
});

describe("mergeEffectivePresets — base + surface filtering", () => {
  it("returns global presets for the surface, ordered, only-enabled", () => {
    const globals = [
      gPreset({ id: 1, label: "B", sortOrder: 20 }),
      gPreset({ id: 2, label: "A", sortOrder: 10 }),
      gPreset({ id: 3, label: "Sales card", surface: "sales", sortOrder: 5 }),
      gPreset({ id: 4, label: "Disabled", enabled: false, sortOrder: 1 }),
    ];
    const out = mergeEffectivePresets({ globals, tenantOwn: [], overrides: [], surface: "marketing", onlyEnabled: true });
    // Sales + disabled excluded; ordered by sortOrder.
    expect(out.map((p) => p.label)).toEqual(["A", "B"]);
    expect(out[0].scope).toBe("global");
    expect(out[0].key).toBe("g2");
  });

  it("'both' presets appear on both surfaces", () => {
    const globals = [gPreset({ id: 1, surface: "both", label: "Universal" })];
    expect(mergeEffectivePresets({ globals, tenantOwn: [], overrides: [], surface: "marketing", onlyEnabled: true })).toHaveLength(1);
    expect(mergeEffectivePresets({ globals, tenantOwn: [], overrides: [], surface: "sales", onlyEnabled: true })).toHaveLength(1);
  });

  it("fail-open: empty config yields []", () => {
    expect(mergeEffectivePresets({ globals: [], tenantOwn: [], overrides: [], surface: "marketing", onlyEnabled: true })).toEqual([]);
  });

  it("manage view (onlyEnabled=false) includes disabled rows", () => {
    const globals = [gPreset({ id: 1, enabled: false })];
    const out = mergeEffectivePresets({ globals, tenantOwn: [], overrides: [], surface: "marketing", onlyEnabled: false });
    expect(out).toHaveLength(1);
    expect(out[0].enabled).toBe(false);
  });
});

describe("mergeEffectivePresets — tenant overrides", () => {
  const globals = [
    gPreset({ id: 1, label: "First", sortOrder: 10 }),
    gPreset({ id: 2, label: "Second", sortOrder: 20 }),
  ];

  function ov(over: Partial<PresetOverrideRow> & { globalPresetId: number }): PresetOverrideRow {
    return {
      enabled: null,
      sortOrder: null,
      label: null,
      description: null,
      icon: null,
      promptSkeleton: null,
      objective: null,
      tiedTemplateSlug: null,
      tiedTemplateIntent: null,
      ...over,
    };
  }

  it("DISABLE: an override with enabled=false hides a global preset", () => {
    const out = mergeEffectivePresets({
      globals,
      tenantOwn: [],
      overrides: [ov({ globalPresetId: 1, enabled: false })],
      surface: "marketing",
      onlyEnabled: true,
    });
    expect(out.map((p) => p.label)).toEqual(["Second"]);
  });

  it("REORDER: an override sortOrder reorders the global preset", () => {
    const out = mergeEffectivePresets({
      globals,
      tenantOwn: [],
      overrides: [ov({ globalPresetId: 2, sortOrder: 5 })], // Second now before First
      surface: "marketing",
      onlyEnabled: true,
    });
    expect(out.map((p) => p.label)).toEqual(["Second", "First"]);
  });

  it("EDIT: override label/skeleton/tie replaces the global values; NULL inherits", () => {
    const out = mergeEffectivePresets({
      globals,
      tenantOwn: [],
      overrides: [
        ov({
          globalPresetId: 1,
          label: "Renamed",
          promptSkeleton: "tenant skeleton",
          tiedTemplateSlug: "global-deal-room",
        }),
      ],
      surface: "marketing",
      onlyEnabled: true,
    });
    const first = out.find((p) => p.globalPresetId === 1)!;
    expect(first.label).toBe("Renamed");
    expect(first.promptSkeleton).toBe("tenant skeleton");
    expect(first.tiedTemplateSlug).toBe("global-deal-room");
    expect(first.overridden).toBe(true);
    // Untouched description inherits the global (null here).
    expect(first.description).toBeNull();
    // Second has no override.
    expect(out.find((p) => p.globalPresetId === 2)!.overridden).toBe(false);
  });

  it("an override pointing at an off-surface global is a no-op for this surface", () => {
    const salesGlobals = [gPreset({ id: 9, surface: "sales", label: "Sales-only" })];
    const out = mergeEffectivePresets({
      globals: salesGlobals,
      tenantOwn: [],
      overrides: [ov({ globalPresetId: 9, label: "Tried to rename" })],
      surface: "marketing",
      onlyEnabled: true,
    });
    expect(out).toEqual([]);
  });
});

describe("mergeEffectivePresets — tenant-specific presets (ADD)", () => {
  it("tenant presets are merged in and sorted with globals", () => {
    const globals = [gPreset({ id: 1, label: "Global", sortOrder: 10 })];
    const tenantOwn = [
      tPreset({ id: 100, tenantId: 7, label: "Tenant A", sortOrder: 5 }),
      tPreset({ id: 101, tenantId: 7, label: "Tenant B disabled", sortOrder: 30, enabled: false }),
    ];
    const out = mergeEffectivePresets({ globals, tenantOwn, overrides: [], surface: "marketing", onlyEnabled: true });
    expect(out.map((p) => p.label)).toEqual(["Tenant A", "Global"]);
    expect(out[0].scope).toBe("tenant");
    expect(out[0].key).toBe("t100");
    expect(out[0].tenantPresetId).toBe(100);
  });
});

describe("preset template tie → eligibility gating", () => {
  // A preset's tiedTemplateSlug feeds the existing eligibility candidate list;
  // selectEligibleTemplate decides whether it actually surfaces.
  const tiedCandidate: EligibilityCandidate = {
    slug: "global-deal-room",
    label: "Deal Room",
    eligibleSegments: ["DSO"],
    eligibleFunnelStages: ["advance"],
  };

  it("a tied template surfaces only when its eligibility matches the context", () => {
    const eligible = selectEligibleTemplate(
      { segment: "DSO", funnelStage: "advance" },
      [tiedCandidate],
      "template-preferred",
    );
    expect(eligible.recommendedSlug).toBe("global-deal-room");

    const ineligible = selectEligibleTemplate(
      { segment: "SMB", funnelStage: "book-meeting" },
      [tiedCandidate],
      "template-preferred",
    );
    // Wrong segment/stage → not eligible → from-scratch (safer).
    expect(ineligible.recommendedSlug).toBeNull();
    expect(ineligible.fromScratch).toBe(true);
  });

  it("a preset with no tie ⇒ no candidate ⇒ AI from scratch", () => {
    const out = selectEligibleTemplate({ segment: "DSO" }, [], "template-preferred");
    expect(out.recommendedSlug).toBeNull();
    expect(out.fromScratch).toBe(true);
  });
});

describe("resolvePresetTemplateTie — marketing chip tie gating", () => {
  // The chip already PICKED a specific tied slug; this gates THAT slug through
  // the eligibility engine + tenant governance, mirroring the sales microsite
  // recommend gate. Candidates always include the tied slug's own row.
  const eventTemplate: EligibilityCandidate = {
    slug: "event-landing",
    label: "Event",
    eligibleSegments: ["DSO"],
    eligibleFunnelStages: ["awareness"],
  };
  // A second eligible-elsewhere template proves we never SUBSTITUTE a different
  // template for the chip's tie — it's the tied slug or from-scratch.
  const otherTemplate: EligibilityCandidate = {
    slug: "pricing-landing",
    label: "Pricing",
    eligibleSegments: ["SMB"],
    eligibleFunnelStages: ["decision"],
  };

  it("ELIGIBLE tied template → returned, fromScratch=false, with reasoning", () => {
    const out = resolvePresetTemplateTie({
      tiedTemplateSlug: "event-landing",
      context: { segment: "DSO", funnelStage: "awareness" },
      candidates: [eventTemplate, otherTemplate],
      aiBehavior: "template-preferred",
    });
    expect(out.recommendedTemplateSlug).toBe("event-landing");
    expect(out.fromScratch).toBe(false);
    expect(out.reasoning.some((r) => /Using the .*Event.* template/.test(r))).toBe(true);
  });

  it("INELIGIBLE tied template (wrong segment) → null / from-scratch + reason", () => {
    const out = resolvePresetTemplateTie({
      tiedTemplateSlug: "event-landing",
      context: { segment: "SMB", funnelStage: "awareness" },
      candidates: [eventTemplate, otherTemplate],
      aiBehavior: "template-preferred",
    });
    expect(out.recommendedTemplateSlug).toBeNull();
    expect(out.fromScratch).toBe(true);
    expect(out.reasoning.some((r) => /isn't eligible/.test(r))).toBe(true);
  });

  it("does NOT substitute a different eligible template for the chip's tie", () => {
    // pricing-landing IS eligible for this context, but the chip tied to the
    // event template — we must fall back to scratch, not silently swap.
    const out = resolvePresetTemplateTie({
      tiedTemplateSlug: "event-landing",
      context: { segment: "SMB", funnelStage: "decision" },
      candidates: [eventTemplate, otherTemplate],
      aiBehavior: "template-preferred",
    });
    expect(out.recommendedTemplateSlug).toBeNull();
    expect(out.fromScratch).toBe(true);
  });

  it("ai-from-scratch-only (governance default) → null even when eligible", () => {
    const out = resolvePresetTemplateTie({
      tiedTemplateSlug: "event-landing",
      context: { segment: "DSO", funnelStage: "awareness" },
      candidates: [eventTemplate, otherTemplate],
      aiBehavior: "ai-from-scratch-only",
    });
    expect(out.recommendedTemplateSlug).toBeNull();
    expect(out.fromScratch).toBe(true);
    // The governance reason from the engine is preserved.
    expect(out.reasoning.some((r) => /ai-from-scratch-only/.test(r))).toBe(true);
  });

  it("template-required: eligible tie returned regardless of confidence", () => {
    const out = resolvePresetTemplateTie({
      tiedTemplateSlug: "event-landing",
      context: { segment: "DSO", funnelStage: "awareness" },
      candidates: [eventTemplate],
      aiBehavior: "template-required",
    });
    expect(out.recommendedTemplateSlug).toBe("event-landing");
    expect(out.fromScratch).toBe(false);
  });

  it("template-preferred + WILDCARD tie (no declared axes) → low confidence → from-scratch", () => {
    // A tie that declares NOTHING is eligible everywhere but only on a wildcard
    // basis; under template-preferred it sits below the auto-recommend threshold
    // → scratch (matches the engine's confidence gate).
    const wildcardTie: EligibilityCandidate = { slug: "generic-landing", label: "Generic" };
    const out = resolvePresetTemplateTie({
      tiedTemplateSlug: "generic-landing",
      context: { segment: "DSO", funnelStage: "awareness" },
      candidates: [wildcardTie],
      aiBehavior: "template-preferred",
    });
    expect(out.recommendedTemplateSlug).toBeNull();
    expect(out.fromScratch).toBe(true);
  });

  it("unconstrained context (no segment) with a wildcard tie under template-required → returned", () => {
    // template-required takes the best eligible regardless of threshold; a
    // wildcard tie remains eligible when there's nothing to contradict it.
    const wildcardTie: EligibilityCandidate = { slug: "generic-landing", label: "Generic" };
    const out = resolvePresetTemplateTie({
      tiedTemplateSlug: "generic-landing",
      context: {},
      candidates: [wildcardTie],
      aiBehavior: "template-required",
    });
    expect(out.recommendedTemplateSlug).toBe("generic-landing");
    expect(out.fromScratch).toBe(false);
  });
});
