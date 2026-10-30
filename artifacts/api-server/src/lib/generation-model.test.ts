import { describe, it, expect } from "vitest";
import {
  resolveGenerationModel,
  modelLocksTemperature,
  samplingParams,
  describeGenerationModels,
  resolveReasoningEffort,
  DEFAULT_GENERATION_MODEL,
  GENERATION_MODEL_PATHS,
} from "./generation-model";

describe("resolveGenerationModel", () => {
  it("defaults every path to gpt-4o when nothing is configured", () => {
    for (const p of GENERATION_MODEL_PATHS) expect(resolveGenerationModel(p, {})).toBe(DEFAULT_GENERATION_MODEL);
    expect(DEFAULT_GENERATION_MODEL).toBe("gpt-4o");
  });

  it("GENERATION_MODEL applies to every path; a per-path variable wins over it", () => {
    const env = { GENERATION_MODEL: "gpt-5", GENERATION_MODEL_CRITIQUE: "gpt-4o" };
    expect(resolveGenerationModel("GENERAL", env)).toBe("gpt-5");
    expect(resolveGenerationModel("MICROSITE", env)).toBe("gpt-5");
    expect(resolveGenerationModel("CRITIQUE", env)).toBe("gpt-4o");
  });

  it("ignores blank / whitespace values and trims real ones", () => {
    expect(resolveGenerationModel("GENERAL", { GENERATION_MODEL: "   " })).toBe("gpt-4o");
    expect(resolveGenerationModel("GENERAL", { GENERATION_MODEL_GENERAL: "", GENERATION_MODEL: " gpt-5 " })).toBe("gpt-5");
  });

  it("describeGenerationModels lists every path", () => {
    const d = describeGenerationModels({ GENERATION_MODEL_PLANNER: "gpt-4o-mini" });
    expect(Object.keys(d).sort()).toEqual([...GENERATION_MODEL_PATHS].sort());
    expect(d.PLANNER).toBe("gpt-4o-mini");
    expect(d.GENERAL).toBe("gpt-4o");
  });
});

describe("temperature guard", () => {
  it("locks temperature for the gpt-5 family and o-series reasoning models", () => {
    for (const m of ["gpt-5", "gpt-5-mini", "gpt-5.1", "GPT-5-pro", "o1", "o3-mini", "o4-mini", "o1-preview"]) {
      expect(modelLocksTemperature(m), m).toBe(true);
    }
  });

  it("keeps temperature for gpt-4o-class and other models", () => {
    for (const m of ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gemini-2.5-flash", "claude-sonnet-4-5"]) {
      expect(modelLocksTemperature(m), m).toBe(false);
    }
  });

  it("samplingParams spreads to a temperature only when the model takes one", () => {
    expect(samplingParams("gpt-4o", 0.7, {})).toEqual({ temperature: 0.7 });
    expect(samplingParams("gpt-5", 0.7, {})).toEqual({});
    expect({ model: "gpt-5", ...samplingParams("gpt-5", 0.3, {}) }).not.toHaveProperty("temperature");
  });

  it("adds reasoning_effort for reasoning models only when GENERATION_REASONING_EFFORT is set and valid", () => {
    expect(samplingParams("gpt-5", 0.7, { GENERATION_REASONING_EFFORT: "low" })).toEqual({ reasoning_effort: "low" });
    expect(samplingParams("gpt-5", 0.7, { GENERATION_REASONING_EFFORT: " Minimal " })).toEqual({ reasoning_effort: "minimal" });
    expect(samplingParams("gpt-5", 0.7, { GENERATION_REASONING_EFFORT: "turbo" })).toEqual({});
    // gpt-4o never gets a reasoning parameter, whatever the env says.
    expect(samplingParams("gpt-4o", 0.7, { GENERATION_REASONING_EFFORT: "low" })).toEqual({ temperature: 0.7 });
    expect(resolveReasoningEffort({})).toBeNull();
  });
});
