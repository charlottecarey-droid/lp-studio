// Single place that maps a Stripe price → canonical plan tier. Uses the
// price's `lookup_key` so we never hardcode `price_xxx` ids (those rotate
// across environments). The seed script (`scripts/src/seed-stripe-products.ts`)
// creates prices with these exact keys; the webhook resolves the active
// subscription's first item's price.lookup_key back to a tier.
//
// PLAN_FEATURES (lib/planFeatures.ts) remains the source of truth for what
// each tier unlocks. Stripe only ever decides *which* tier the tenant is on.
import type { Plan } from "./planFeatures";

// Stable identifiers seeded into Stripe. Reused by the seed CLI and the
// webhook so a rename touches exactly one file.
export const LOOKUP_KEYS = {
  growthMonthly: "growth_monthly",
  growthAnnual: "growth_annual",
} as const;

export type StripeLookupKey = (typeof LOOKUP_KEYS)[keyof typeof LOOKUP_KEYS];

export const ALL_LOOKUP_KEYS: readonly StripeLookupKey[] = [
  LOOKUP_KEYS.growthMonthly,
  LOOKUP_KEYS.growthAnnual,
];

export function isKnownLookupKey(s: unknown): s is StripeLookupKey {
  return typeof s === "string" && (ALL_LOOKUP_KEYS as readonly string[]).includes(s);
}

/**
 * Resolve a price lookup_key to a canonical plan tier.
 *
 * Returns `null` for unknown keys so the webhook can log + skip (rather
 * than silently downgrade the tenant). Enterprise is sales-assisted and
 * never set via webhook — superadmin flips that manually.
 */
export function planForLookupKey(lookupKey: string | null | undefined): Plan | null {
  switch (lookupKey) {
    case LOOKUP_KEYS.growthMonthly:
    case LOOKUP_KEYS.growthAnnual:
      return "growth";
    default:
      return null;
  }
}

/** "monthly" | "annual" for known lookup keys; null otherwise. */
export function cadenceForLookupKey(lookupKey: string | null | undefined): "monthly" | "annual" | null {
  if (lookupKey === LOOKUP_KEYS.growthAnnual) return "annual";
  if (lookupKey === LOOKUP_KEYS.growthMonthly) return "monthly";
  return null;
}

/**
 * Inverse mapping used by the checkout-session route: given a tier + billing
 * cadence, return the lookup_key the seed script promises will exist. The
 * caller then resolves it to a live price id via `stripe.prices.list`.
 *
 * Only `growth` is self-serve. `starter` is the implicit free tier (no
 * Stripe interaction); `enterprise` is sales-assisted.
 */
export function lookupKeyFor(plan: "growth", cadence: "monthly" | "annual"): StripeLookupKey {
  if (plan === "growth") {
    return cadence === "annual" ? LOOKUP_KEYS.growthAnnual : LOOKUP_KEYS.growthMonthly;
  }
  throw new Error(`No self-serve lookup key for plan="${plan as string}"`);
}
