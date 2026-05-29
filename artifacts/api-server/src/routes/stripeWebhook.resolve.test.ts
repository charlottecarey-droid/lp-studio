import { describe, it, expect } from "vitest";
import type Stripe from "stripe";
import { resolvePlanFromSubscription } from "./stripeWebhook";

// Minimal Stripe.Subscription shape factory — only the fields
// resolvePlanFromSubscription reads. Cast through unknown so we don't have to
// satisfy the full (huge) Stripe type in a unit test.
function makeSub(opts: {
  status?: Stripe.Subscription.Status;
  lookupKey?: string | null;
  metaPlan?: string | null;
}): Stripe.Subscription {
  const { status = "active", lookupKey = null, metaPlan = null } = opts;
  return {
    status,
    items: {
      data: [
        {
          price: {
            lookup_key: lookupKey,
            metadata: metaPlan == null ? {} : { lpstudio_plan: metaPlan },
          },
        },
      ],
    },
  } as unknown as Stripe.Subscription;
}

describe("resolvePlanFromSubscription", () => {
  it("maps each known lookup_key to its tier", () => {
    expect(resolvePlanFromSubscription(makeSub({ lookupKey: "starter_monthly" }))).toBe("starter");
    expect(resolvePlanFromSubscription(makeSub({ lookupKey: "growth_annual" }))).toBe("growth");
    expect(resolvePlanFromSubscription(makeSub({ lookupKey: "scale_monthly" }))).toBe("scale");
  });

  it("downgrades any non-active status to free (never the paid starter floor)", () => {
    for (const status of ["canceled", "unpaid", "incomplete_expired"] as Stripe.Subscription.Status[]) {
      // Even with a paid lookup_key present, a dead subscription → free.
      expect(resolvePlanFromSubscription(makeSub({ status, lookupKey: "growth_monthly" }))).toBe("free");
    }
  });

  it("falls back to a VALID self-serve metadata tier when lookup_key is missing (grandfathered price)", () => {
    expect(resolvePlanFromSubscription(makeSub({ lookupKey: null, metaPlan: "growth" }))).toBe("growth");
    expect(resolvePlanFromSubscription(makeSub({ lookupKey: "", metaPlan: "scale" }))).toBe("scale");
  });

  it("does NOT silently downgrade on unknown/typo metadata — returns null so the plan is left untouched", () => {
    for (const bad of ["gowth", "enterprise", "free", "PRO", ""]) {
      expect(resolvePlanFromSubscription(makeSub({ lookupKey: null, metaPlan: bad }))).toBeNull();
    }
    expect(resolvePlanFromSubscription(makeSub({ lookupKey: null, metaPlan: null }))).toBeNull();
  });

  it("prefers lookup_key over metadata when both are present", () => {
    expect(
      resolvePlanFromSubscription(makeSub({ lookupKey: "starter_monthly", metaPlan: "scale" })),
    ).toBe("starter");
  });
});
