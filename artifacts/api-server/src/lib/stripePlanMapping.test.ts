import { describe, it, expect } from "vitest";
import { PLAN_CONFIG } from "@workspace/plan-config";
import {
  ALL_LOOKUP_KEYS,
  LOOKUP_KEYS,
  cadenceForLookupKey,
  isKnownLookupKey,
  lookupKeyFor,
  planForLookupKey,
  type Cadence,
  type SelfServePaidPlan,
} from "./stripePlanMapping";

const SELF_SERVE: readonly SelfServePaidPlan[] = ["starter", "growth", "scale"];
const CADENCES: readonly Cadence[] = ["monthly", "annual"];

describe("stripePlanMapping", () => {
  it("exposes exactly the 6 self-serve lookup keys", () => {
    expect([...ALL_LOOKUP_KEYS].sort()).toEqual(
      [
        "growth_annual",
        "growth_monthly",
        "scale_annual",
        "scale_monthly",
        "starter_annual",
        "starter_monthly",
      ].sort(),
    );
  });

  it("round-trips tier + cadence through lookupKeyFor → planForLookupKey/cadenceForLookupKey", () => {
    for (const plan of SELF_SERVE) {
      for (const cadence of CADENCES) {
        const key = lookupKeyFor(plan, cadence);
        expect(isKnownLookupKey(key)).toBe(true);
        expect(planForLookupKey(key)).toBe(plan);
        expect(cadenceForLookupKey(key)).toBe(cadence);
      }
    }
  });

  it("uses the `<tier>_<cadence>` key convention the seed script mirrors", () => {
    // The seed script (scripts/src/seed-stripe-products.ts) reproduces this
    // convention locally to avoid a cross-package import. If this convention
    // changes here, that mirror MUST change too.
    for (const plan of SELF_SERVE) {
      for (const cadence of CADENCES) {
        expect(lookupKeyFor(plan, cadence)).toBe(`${plan}_${cadence}`);
      }
    }
  });

  it("resolves every ALL_LOOKUP_KEYS entry to a tier + cadence", () => {
    for (const key of ALL_LOOKUP_KEYS) {
      expect(planForLookupKey(key)).not.toBeNull();
      expect(cadenceForLookupKey(key)).not.toBeNull();
    }
  });

  it("returns null for unknown / empty / legacy keys", () => {
    for (const bad of ["", "enterprise_monthly", "free_monthly", "growth", "pro_annual", null, undefined]) {
      expect(planForLookupKey(bad as string | null | undefined)).toBeNull();
      expect(cadenceForLookupKey(bad as string | null | undefined)).toBeNull();
      expect(isKnownLookupKey(bad)).toBe(false);
    }
  });

  it("named LOOKUP_KEYS constants match the derived keys", () => {
    expect(LOOKUP_KEYS.starterMonthly).toBe(lookupKeyFor("starter", "monthly"));
    expect(LOOKUP_KEYS.starterAnnual).toBe(lookupKeyFor("starter", "annual"));
    expect(LOOKUP_KEYS.growthMonthly).toBe(lookupKeyFor("growth", "monthly"));
    expect(LOOKUP_KEYS.growthAnnual).toBe(lookupKeyFor("growth", "annual"));
    expect(LOOKUP_KEYS.scaleMonthly).toBe(lookupKeyFor("scale", "monthly"));
    expect(LOOKUP_KEYS.scaleAnnual).toBe(lookupKeyFor("scale", "annual"));
  });
});

describe("seed catalog amounts derive from PLAN_CONFIG (no drift)", () => {
  // Mirror of the seed script's unit_amount derivation. The seed builds Stripe
  // prices from these exact figures, so this guards the marketing/config price
  // against what Stripe would charge.
  const expectedAmount = (plan: SelfServePaidPlan, cadence: Cadence): number => {
    const entry = PLAN_CONFIG[plan];
    if (cadence === "monthly") return Math.round((entry.priceMonthly ?? 0) * 100);
    return Math.round((entry.priceAnnual ?? 0) * 12 * 100);
  };

  it("every self-serve tier has non-null monthly + annual prices", () => {
    for (const plan of SELF_SERVE) {
      expect(PLAN_CONFIG[plan].priceMonthly).not.toBeNull();
      expect(PLAN_CONFIG[plan].priceAnnual).not.toBeNull();
      expect(PLAN_CONFIG[plan].selfServe).toBe(true);
    }
  });

  it("derives the canonical seed amounts (cents)", () => {
    expect(expectedAmount("starter", "monthly")).toBe(5900);
    expect(expectedAmount("starter", "annual")).toBe(58800);
    expect(expectedAmount("growth", "monthly")).toBe(24900);
    expect(expectedAmount("growth", "annual")).toBe(238800);
    expect(expectedAmount("scale", "monthly")).toBe(64900);
    expect(expectedAmount("scale", "annual")).toBe(598800);
  });
});
