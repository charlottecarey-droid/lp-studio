// Single place that maps a Stripe price → canonical plan tier. Uses the
// price's `lookup_key` so we never hardcode `price_xxx` ids (those rotate
// across environments). The seed script (`scripts/src/seed-stripe-products.ts`)
// creates prices with these exact keys; the webhook resolves the active
// subscription's first item's price.lookup_key back to a tier.
//
// The canonical plan/cap matrix lives in `@workspace/plan-config` (mirrored
// into the `plan_config` DB table). Stripe only ever decides *which* tier the
// tenant is on — never what a tier unlocks.
import type { Plan } from "./planFeatures";

// The three self-serve (Stripe-purchasable) paid tiers. `free` is the
// no-Stripe floor; `enterprise` is sales-assisted. Each has a monthly and an
// annual price seeded into Stripe.
export type SelfServePaidPlan = "starter" | "growth" | "scale";

export type Cadence = "monthly" | "annual";

// Stable identifiers seeded into Stripe. Reused by the seed CLI and the
// webhook so a rename touches exactly one file. Format: `<tier>_<cadence>`.
export const LOOKUP_KEYS = {
  starterMonthly: "starter_monthly",
  starterAnnual: "starter_annual",
  growthMonthly: "growth_monthly",
  growthAnnual: "growth_annual",
  scaleMonthly: "scale_monthly",
  scaleAnnual: "scale_annual",
} as const;

export type StripeLookupKey = (typeof LOOKUP_KEYS)[keyof typeof LOOKUP_KEYS];

export const ALL_LOOKUP_KEYS: readonly StripeLookupKey[] = [
  LOOKUP_KEYS.starterMonthly,
  LOOKUP_KEYS.starterAnnual,
  LOOKUP_KEYS.growthMonthly,
  LOOKUP_KEYS.growthAnnual,
  LOOKUP_KEYS.scaleMonthly,
  LOOKUP_KEYS.scaleAnnual,
];

export function isKnownLookupKey(s: unknown): s is StripeLookupKey {
  return typeof s === "string" && (ALL_LOOKUP_KEYS as readonly string[]).includes(s);
}

// The self-serve paid tiers as a runtime list + type guard. Used to validate
// untrusted tier markers (e.g. `price.metadata.lpstudio_plan`) before trusting
// them — an unknown/typo value must NOT be coerced (that would silently
// downgrade a paying tenant), so callers treat a failed guard as "no tier".
export const SELF_SERVE_PAID_PLANS: readonly SelfServePaidPlan[] = ["starter", "growth", "scale"];

export function isSelfServePaidPlan(s: unknown): s is SelfServePaidPlan {
  return typeof s === "string" && (SELF_SERVE_PAID_PLANS as readonly string[]).includes(s);
}

// Tier + cadence for every known lookup key. Single table both directions
// (forward: key → {tier, cadence}; inverse: lookupKeyFor) read from.
const LOOKUP_KEY_TABLE: Record<StripeLookupKey, { plan: SelfServePaidPlan; cadence: Cadence }> = {
  [LOOKUP_KEYS.starterMonthly]: { plan: "starter", cadence: "monthly" },
  [LOOKUP_KEYS.starterAnnual]: { plan: "starter", cadence: "annual" },
  [LOOKUP_KEYS.growthMonthly]: { plan: "growth", cadence: "monthly" },
  [LOOKUP_KEYS.growthAnnual]: { plan: "growth", cadence: "annual" },
  [LOOKUP_KEYS.scaleMonthly]: { plan: "scale", cadence: "monthly" },
  [LOOKUP_KEYS.scaleAnnual]: { plan: "scale", cadence: "annual" },
};

/**
 * Resolve a price lookup_key to a canonical plan tier.
 *
 * Returns `null` for unknown keys so the webhook can log + skip (rather
 * than silently downgrade the tenant). Enterprise is sales-assisted and
 * never set via webhook — superadmin flips that manually.
 */
export function planForLookupKey(lookupKey: string | null | undefined): Plan | null {
  if (!lookupKey || !isKnownLookupKey(lookupKey)) return null;
  return LOOKUP_KEY_TABLE[lookupKey].plan;
}

/** "monthly" | "annual" for known lookup keys; null otherwise. */
export function cadenceForLookupKey(lookupKey: string | null | undefined): Cadence | null {
  if (!lookupKey || !isKnownLookupKey(lookupKey)) return null;
  return LOOKUP_KEY_TABLE[lookupKey].cadence;
}

/**
 * Inverse mapping used by the checkout-session route: given a self-serve paid
 * tier + billing cadence, return the lookup_key the seed script promises will
 * exist. The caller then resolves it to a live price id via
 * `stripe.prices.list`.
 *
 * `free` (no Stripe) and `enterprise` (sales-assisted) have no lookup key.
 */
export function lookupKeyFor(plan: SelfServePaidPlan, cadence: Cadence): StripeLookupKey {
  const match = (Object.entries(LOOKUP_KEY_TABLE) as [StripeLookupKey, { plan: SelfServePaidPlan; cadence: Cadence }][])
    .find(([, v]) => v.plan === plan && v.cadence === cadence);
  if (!match) throw new Error(`No self-serve lookup key for plan="${plan}" cadence="${cadence}"`);
  return match[0];
}
