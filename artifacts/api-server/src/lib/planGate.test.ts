import { describe, it, expect } from "vitest";
import { PLAN_CONFIG } from "@workspace/plan-config";
import {
  capUpgradeBody,
  featureUpgradeBody,
  minimumPlanForCap,
  minimumPlanForFeature,
  UPGRADE_URL,
} from "./planGate";

// All assertions run against the canonical PLAN_CONFIG matrix so the
// structured-402 contract is pinned to the shipped tier defaults:
//   pages:    free 1,  starter 10, growth+ unlimited
//   forms:    free 1,  starter 5,  growth+ unlimited
//   userSeats free 1,  starter 3,  growth 10, scale 25, ent unlimited
//   aiGen/mo  free 30, starter 200, growth+ unlimited
//   heatmap   free 1000, starter 5000, growth 25000, scale 100000, ent unlimited
//   salesConsole -> growth, aiImageGen -> scale, customDomain -> starter
const config = PLAN_CONFIG;

describe("minimumPlanForFeature", () => {
  it("salesConsole resolves to growth (first tier that enables it)", () => {
    expect(minimumPlanForFeature("salesConsole", config)).toBe("growth");
  });
  it("aiImageGen resolves to scale", () => {
    expect(minimumPlanForFeature("aiImageGen", config)).toBe("scale");
  });
  it("customDomain resolves to starter", () => {
    expect(minimumPlanForFeature("customDomain", config)).toBe("starter");
  });
});

describe("minimumPlanForCap (lowest tier that admits usage+1)", () => {
  it("pages at the free cap (1) -> starter", () => {
    expect(minimumPlanForCap("pages", 1, config)).toBe("starter");
  });
  it("pages at the starter cap (10) -> growth (unlimited)", () => {
    expect(minimumPlanForCap("pages", 10, config)).toBe("growth");
  });
  it("forms at the free cap (1) -> starter", () => {
    expect(minimumPlanForCap("forms", 1, config)).toBe("starter");
  });
  it("userSeats at the free cap (1) -> starter", () => {
    expect(minimumPlanForCap("userSeats", 1, config)).toBe("starter");
  });
  it("userSeats at the starter cap (3) -> growth", () => {
    expect(minimumPlanForCap("userSeats", 3, config)).toBe("growth");
  });
  it("aiGenerationsPerMonth at the free cap (30) -> starter", () => {
    expect(minimumPlanForCap("aiGenerationsPerMonth", 30, config)).toBe("starter");
  });
  it("aiGenerationsPerMonth at the starter cap (200) -> growth", () => {
    expect(minimumPlanForCap("aiGenerationsPerMonth", 200, config)).toBe("growth");
  });
  it("heatmapSessionsPerMonth at the free cap (1000) -> starter", () => {
    expect(minimumPlanForCap("heatmapSessionsPerMonth", 1000, config)).toBe("starter");
  });
  it("heatmapSessionsPerMonth at the scale cap (100000) -> enterprise (unlimited)", () => {
    expect(minimumPlanForCap("heatmapSessionsPerMonth", 100000, config)).toBe("enterprise");
  });
});

describe("capUpgradeBody — cap+1 structured 402 per gate", () => {
  it("pages gate on a free tenant at cap", () => {
    expect(capUpgradeBody("pages", 1, 1, "free", config)).toEqual({
      error: "plan_upgrade_required",
      gate: "pages",
      currentUsage: 1,
      cap: 1,
      currentPlan: "free",
      minimumPlanWithFeature: "starter",
      upgradeUrl: UPGRADE_URL,
    });
  });
  it("forms gate on a starter tenant at cap", () => {
    expect(capUpgradeBody("forms", 5, 5, "starter", config)).toEqual({
      error: "plan_upgrade_required",
      gate: "forms",
      currentUsage: 5,
      cap: 5,
      currentPlan: "starter",
      minimumPlanWithFeature: "growth",
      upgradeUrl: UPGRADE_URL,
    });
  });
  it("userSeats gate on a starter tenant at cap", () => {
    expect(capUpgradeBody("userSeats", 3, 3, "starter", config)).toEqual({
      error: "plan_upgrade_required",
      gate: "userSeats",
      currentUsage: 3,
      cap: 3,
      currentPlan: "starter",
      minimumPlanWithFeature: "growth",
      upgradeUrl: UPGRADE_URL,
    });
  });
  it("aiGenerationsPerMonth gate on a free tenant at cap", () => {
    expect(capUpgradeBody("aiGenerationsPerMonth", 30, 30, "free", config)).toEqual({
      error: "plan_upgrade_required",
      gate: "aiGenerationsPerMonth",
      currentUsage: 30,
      cap: 30,
      currentPlan: "free",
      minimumPlanWithFeature: "starter",
      upgradeUrl: UPGRADE_URL,
    });
  });
  it("heatmapSessionsPerMonth gate on a free tenant at cap", () => {
    expect(capUpgradeBody("heatmapSessionsPerMonth", 1000, 1000, "free", config)).toEqual({
      error: "plan_upgrade_required",
      gate: "heatmapSessionsPerMonth",
      currentUsage: 1000,
      cap: 1000,
      currentPlan: "free",
      minimumPlanWithFeature: "starter",
      upgradeUrl: UPGRADE_URL,
    });
  });
});

describe("featureUpgradeBody — boolean gate body", () => {
  it("salesConsole on a starter tenant", () => {
    expect(featureUpgradeBody("salesConsole", "starter", config)).toEqual({
      error: "plan_upgrade_required",
      gate: "salesConsole",
      currentUsage: null,
      cap: null,
      currentPlan: "starter",
      minimumPlanWithFeature: "growth",
      upgradeUrl: UPGRADE_URL,
    });
  });
});
