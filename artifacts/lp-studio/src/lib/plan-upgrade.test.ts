import { describe, it, expect } from "vitest";
import { copyForGate, copyForFeature, minimumTierForGate, parseUpgradeBody } from "./plan-upgrade";

describe("minimumTierForGate", () => {
  it("resolves boolean feature gates to their lowest enabling tier", () => {
    // customDomain is admitted from starter up; salesConsole from growth;
    // aiImageGen from scale (per the canonical matrix).
    expect(minimumTierForGate("customDomain")).toBe("starter");
    expect(minimumTierForGate("salesConsole")).toBe("growth");
    expect(minimumTierForGate("aiImageGen")).toBe("scale");
  });

  it("resolves cap gates to the lowest tier that admits one more than usage", () => {
    // At 30 AI generations, free (cap 30) is full; starter (200) admits more.
    expect(minimumTierForGate("aiGenerationsPerMonth", 30)).toBe("starter");
    // Growth+ is unlimited (null) for AI generations.
    expect(minimumTierForGate("aiGenerationsPerMonth", 100000)).toBe("growth");
  });

  it("returns null for an unknown gate", () => {
    expect(minimumTierForGate("nope")).toBeNull();
  });
});

describe("copyForGate", () => {
  it("prefers the server-provided minimumPlanWithFeature for the unlock tier", () => {
    const copy = copyForGate({
      gate: "salesConsole",
      minimumPlanWithFeature: "scale",
    });
    expect(copy.unlockTier).toBe("scale");
    expect(copy.selfServe).toBe(true);
    expect(copy.title).toContain("Sales Console");
  });

  it("falls back to a client-computed tier when no server payload is given", () => {
    const copy = copyForGate({ gate: "salesConsole" });
    expect(copy.unlockTier).toBe("growth");
  });

  it("renders usage-aware copy for cap gates", () => {
    const copy = copyForGate({
      gate: "pages",
      minimumPlanWithFeature: "growth",
      currentUsage: 3,
      cap: 3,
    });
    expect(copy.title).toMatch(/limit/i);
    expect(copy.subtitle).toContain("3 of 3");
    expect(copy.unlockTier).toBe("growth");
  });

  it("uses 'a'/'an' correctly in boolean-gate titles", () => {
    const ent = copyForGate({ gate: "aiImageGen", minimumPlanWithFeature: "enterprise" });
    expect(ent.title).toContain("an Enterprise feature");
    const growth = copyForGate({ gate: "salesConsole", minimumPlanWithFeature: "growth" });
    expect(growth.title).toContain("a Growth feature");
  });

  it("marks enterprise as non-self-serve so the CTA routes to sales", () => {
    const copy = copyForGate({ gate: "aiImageGen", minimumPlanWithFeature: "enterprise" });
    expect(copy.selfServe).toBe(false);
  });

  it("never marks free as self-serve (no Stripe SKU for free)", () => {
    const copy = copyForGate({ gate: "pages", minimumPlanWithFeature: "free" });
    expect(copy.unlockTier).toBe("free");
    expect(copy.selfServe).toBe(false);
  });

  it("falls back gracefully for an unknown gate", () => {
    const copy = copyForGate({ gate: "mystery", minimumPlanWithFeature: "growth" });
    expect(copy.title).toMatch(/isn't on your current plan/i);
    expect(copy.bullets.length).toBeGreaterThan(0);
  });

  it("copyForFeature is a thin alias over copyForGate", () => {
    expect(copyForFeature("customDomain")).toEqual(copyForGate({ gate: "customDomain" }));
  });
});

describe("parseUpgradeBody", () => {
  it("maps a cap-gate 402 contract into an event detail", () => {
    expect(
      parseUpgradeBody({
        error: "plan_upgrade_required",
        gate: "pages",
        currentUsage: 1,
        cap: 1,
        currentPlan: "free",
        minimumPlanWithFeature: "starter",
        upgradeUrl: "/settings/billing",
      }),
    ).toEqual({
      gate: "pages",
      currentPlan: "free",
      currentUsage: 1,
      cap: 1,
      minimumPlanWithFeature: "starter",
      upgradeUrl: "/settings/billing",
    });
  });

  it("maps a boolean-gate 402 (null usage/cap) into an event detail", () => {
    const detail = parseUpgradeBody({
      error: "plan_upgrade_required",
      gate: "salesConsole",
      currentUsage: null,
      cap: null,
      currentPlan: "starter",
      minimumPlanWithFeature: "growth",
      upgradeUrl: "/settings/billing",
    });
    expect(detail).toMatchObject({ gate: "salesConsole", currentUsage: null, cap: null });
  });

  it("defaults a missing upgradeUrl to /settings/billing", () => {
    const detail = parseUpgradeBody({ error: "plan_upgrade_required", gate: "forms" });
    expect(detail?.upgradeUrl).toBe("/settings/billing");
    expect(detail?.currentPlan).toBe("free");
  });

  it("returns null for non-contract bodies", () => {
    expect(parseUpgradeBody(null)).toBeNull();
    expect(parseUpgradeBody({ error: "something_else" })).toBeNull();
    expect(parseUpgradeBody({ error: "plan_upgrade_required" })).toBeNull();
    expect(parseUpgradeBody("nope")).toBeNull();
  });

  it("coerces an invalid minimumPlanWithFeature to null instead of trusting it", () => {
    const detail = parseUpgradeBody({
      error: "plan_upgrade_required",
      gate: "pages",
      minimumPlanWithFeature: "platinum",
    });
    expect(detail?.minimumPlanWithFeature).toBeNull();
  });
});
