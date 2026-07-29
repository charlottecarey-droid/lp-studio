import { describe, expect, it } from "vitest";
import { betaOfferCap, betaOfferStatus } from "./betaOffer";
import { effectivePlan, BETA_OFFER_TIER, BETA_OFFER_DURATION_DAYS, normalizeTrialTier } from "@workspace/plan-config";

describe("betaOfferCap", () => {
  it("parses the env value", () => {
    expect(betaOfferCap("25")).toBe(25);
    expect(betaOfferCap("100")).toBe(100);
  });

  it("anything unusable means OFF, never a surprise default", () => {
    for (const v of [undefined, null, "", "0", "-5", "abc", "NaN"]) {
      expect(betaOfferCap(v as string | undefined)).toBe(0);
    }
  });

  it("floors fractions rather than inventing an extra spot", () => {
    expect(betaOfferCap("25.9")).toBe(25);
  });
});

describe("betaOfferStatus", () => {
  it("reports the enforced cap and live remainder — one source of truth", () => {
    expect(betaOfferStatus(25, 10)).toMatchObject({ enabled: true, cap: 25, claimed: 10, remaining: 15 });
  });

  it("full = disabled, and never a negative remainder", () => {
    expect(betaOfferStatus(25, 25)).toMatchObject({ enabled: false, remaining: 0 });
    // Claimed can exceed cap after the cap is LOWERED — display must not lie.
    expect(betaOfferStatus(25, 30)).toMatchObject({ enabled: false, remaining: 0, claimed: 25 });
  });

  it("cap 0 = offer off", () => {
    expect(betaOfferStatus(0, 0).enabled).toBe(false);
  });

  it("carries what the offer grants", () => {
    const s = betaOfferStatus(25, 0);
    expect(s.tier).toBe(BETA_OFFER_TIER);
    expect(s.durationDays).toBe(BETA_OFFER_DURATION_DAYS);
  });
});

describe("effectivePlan with a per-tenant trial tier", () => {
  const future = new Date(Date.now() + 86_400_000);
  const past = new Date(Date.now() - 86_400_000);

  it("a beta tenant resolves to SCALE while the year runs", () => {
    expect(effectivePlan({ storedPlan: "free", trialExpiresAt: future, trialTier: "scale" })).toBe("scale");
  });

  it("expiry falls back to the stored floor — no new downgrade machinery", () => {
    expect(effectivePlan({ storedPlan: "free", trialExpiresAt: past, trialTier: "scale" })).toBe("free");
  });

  it("a HIGHER stored plan is never downgraded by the trial tier", () => {
    expect(effectivePlan({ storedPlan: "enterprise", trialExpiresAt: future, trialTier: "scale" })).toBe("enterprise");
  });

  it("null tier = the standard Growth trial, so existing rows are untouched", () => {
    expect(effectivePlan({ storedPlan: "free", trialExpiresAt: future, trialTier: null })).toBe("growth");
    expect(effectivePlan({ storedPlan: "free", trialExpiresAt: future })).toBe("growth");
  });

  it("normalizeTrialTier rejects junk instead of trusting the column", () => {
    expect(normalizeTrialTier("scale")).toBe("scale");
    expect(normalizeTrialTier("SCALE")).toBeNull();
    expect(normalizeTrialTier("platinum")).toBeNull();
    expect(normalizeTrialTier(null)).toBeNull();
  });
});
