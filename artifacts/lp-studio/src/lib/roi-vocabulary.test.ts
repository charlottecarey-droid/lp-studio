import { describe, expect, it } from "vitest";
import {
  NEUTRAL_ROI_VOCABULARY,
  DENTAL_ROI_VOCABULARY,
  DEFAULT_ROI_DEFAULTS,
  resolveRoiVocabulary,
  resolveRoiDefaults,
  isRoiCalculatorEnabled,
  computeTimeSaved,
  computeReworkAvoided,
} from "./roi-vocabulary";

describe("resolveRoiVocabulary", () => {
  it("a normal tenant gets neutral wording — no dental left anywhere", () => {
    const v = resolveRoiVocabulary(null, false);
    const all = Object.values(v).join(" | ");
    expect(all).not.toMatch(/dent|chair|remake|DSO|lab |practice/i);
    expect(v.unit).toBe("job");
  });

  it("Dandy keeps its exact dental wording — the page doesn't change for them", () => {
    expect(resolveRoiVocabulary(null, true)).toEqual(DENTAL_ROI_VOCABULARY);
  });

  it("a partial override layers on rather than replacing the whole set", () => {
    const v = resolveRoiVocabulary({ vocabulary: { unit: "project", unitPlural: "projects" } }, false);
    expect(v.unit).toBe("project");
    expect(v.unitPlural).toBe("projects");
    // Untouched labels survive.
    expect(v.timeNoun).toBe(NEUTRAL_ROI_VOCABULARY.timeNoun);
    expect(v.modelBName).toBe(NEUTRAL_ROI_VOCABULARY.modelBName);
  });

  it("blank or whitespace overrides fall back — a cleared field can't blank the UI", () => {
    const v = resolveRoiVocabulary({ vocabulary: { unit: "   ", modelAName: "" } }, false);
    expect(v.unit).toBe(NEUTRAL_ROI_VOCABULARY.unit);
    expect(v.modelAName).toBe(NEUTRAL_ROI_VOCABULARY.modelAName);
  });

  it("a tenant can override ON TOP of the dental preset", () => {
    const v = resolveRoiVocabulary({ vocabulary: { title: "Lab ROI" } }, true);
    expect(v.title).toBe("Lab ROI");
    expect(v.rework).toBe("remake");
  });

  it("trims what the editor stores", () => {
    expect(resolveRoiVocabulary({ vocabulary: { unit: "  project  " } }, false).unit).toBe("project");
  });
});

describe("resolveRoiDefaults", () => {
  it("unset config keeps the numbers the calculator shipped with", () => {
    expect(resolveRoiDefaults(null)).toEqual(DEFAULT_ROI_DEFAULTS);
  });

  it("a business can start its reps on its own numbers", () => {
    const d = resolveRoiDefaults({ defaults: { modelAVolume: 40, revenuePerHour: 220 } });
    expect(d.modelAVolume).toBe(40);
    expect(d.revenuePerHour).toBe(220);
    expect(d.workingDays).toBe(DEFAULT_ROI_DEFAULTS.workingDays);
  });

  it("zero is a legitimate override, but junk and negatives are not", () => {
    expect(resolveRoiDefaults({ defaults: { pctReinvested: 0 } }).pctReinvested).toBe(0);
    expect(resolveRoiDefaults({ defaults: { unitValue: NaN } }).unitValue).toBe(DEFAULT_ROI_DEFAULTS.unitValue);
    expect(resolveRoiDefaults({ defaults: { unitValue: -5 } }).unitValue).toBe(DEFAULT_ROI_DEFAULTS.unitValue);
  });
});

describe("isRoiCalculatorEnabled", () => {
  it("is opt-OUT — it works for any business now, so it's on by default", () => {
    expect(isRoiCalculatorEnabled(null, false)).toBe(true);
    expect(isRoiCalculatorEnabled({}, false)).toBe(true);
  });

  it("a tenant can hide it", () => {
    expect(isRoiCalculatorEnabled({ enabled: false }, false)).toBe(false);
  });

  it("Dandy always has it", () => {
    expect(isRoiCalculatorEnabled({ enabled: false }, true)).toBe(true);
  });
});

/* The maths must be IDENTICAL to what shipped — this is a relabel, not a
   re-model. These numbers are the previous implementation's, recomputed. */
describe("the models are unchanged by the relabel", () => {
  it("time saved: 150 units × 1.5 × 30min at $500/hr", () => {
    const r = computeTimeSaved({
      volume: 150, unitsSavedPer: 1.5, minutesPerUnitSaved: 30, workingDays: 20,
      revenuePerHour: 500, pctReinvested: 75, reinvestRevenuePerHour: 750,
    });
    expect(r.eventsFreed).toBe(225);
    expect(r.hoursFreed).toBe(112.5);
    expect(r.hoursPerDay).toBeCloseTo(5.625);
    expect(r.revenueMonth).toBe(56_250);
    expect(r.revenueYear).toBe(675_000);
    expect(r.reinvestedHrs).toBeCloseTo(84.375);
    expect(r.reinvestRevenueMonth).toBeCloseTo(63_281.25);
  });

  it("rework: 250 units, 5% → 2%, $1,500 each", () => {
    const r = computeReworkAvoided({
      volume: 250, currentRatePct: 5, improvedRatePct: 2, unitValue: 1500,
      hoursPerRework: 1, hardCostPerUnit: 50, revenuePerHour: 500,
    });
    expect(r.reworkAvoided).toBeCloseTo(7.5);
    expect(r.recoveredMonth).toBeCloseTo(11_250);
    expect(r.recoveredYear).toBeCloseTo(135_000);
    // Hard cost spans EVERY unit, not just the ones avoided.
    expect(r.hardCostMonth).toBe(12_500);
    expect(r.hardCostYear).toBe(150_000);
    expect(r.opportunityYear).toBeCloseTo(45_000);
    expect(r.totalUpsideYear).toBeCloseTo(330_000);
  });

  it("zero working days doesn't produce Infinity in the per-day figure", () => {
    const r = computeTimeSaved({
      volume: 10, unitsSavedPer: 1, minutesPerUnitSaved: 30, workingDays: 0,
      revenuePerHour: 100, pctReinvested: 50, reinvestRevenuePerHour: 100,
    });
    expect(Number.isFinite(r.hoursPerDay)).toBe(true);
    expect(r.hoursPerDay).toBe(0);
  });

  it("an improved rate WORSE than current yields a negative saving, not a hidden one", () => {
    const r = computeReworkAvoided({
      volume: 100, currentRatePct: 2, improvedRatePct: 5, unitValue: 100,
      hoursPerRework: 1, hardCostPerUnit: 0, revenuePerHour: 100,
    });
    expect(r.reworkAvoided).toBeCloseTo(-3);
  });
});
