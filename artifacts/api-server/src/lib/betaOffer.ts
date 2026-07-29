/**
 * Founding-beta offer: the first N self-serve signups get a year of Scale.
 *
 * The cap lives in the env (`BETA_SCALE_OFFER_CAP`) so it can be raised — say
 * 25 → 100 — without a deploy. 0 or unset = offer off. Everything the public
 * site displays comes from the same value the signup path enforces, via
 * GET /lp/beta-offer, so the advertised number can never disagree with the
 * real one. That is deliberate: advertising more spots than exist means
 * signups past the real cap were recruited on a false promise.
 *
 * DB-free on purpose so this is unit-testable; the claim itself happens inside
 * the signup transaction (routes/auth.ts) under an advisory lock.
 */
import { BETA_OFFER_TIER, BETA_OFFER_DURATION_DAYS } from "@workspace/plan-config";

/** Parse the env cap. Non-numeric, negative or absent → 0 (offer off). */
export function betaOfferCap(raw: string | undefined | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

export interface BetaOfferStatus {
  enabled: boolean;
  cap: number;
  claimed: number;
  remaining: number;
  tier: string;
  durationDays: number;
}

/** Shape the public status from the enforced cap + live claimed count. */
export function betaOfferStatus(cap: number, claimed: number): BetaOfferStatus {
  const safeClaimed = Math.max(0, claimed);
  return {
    enabled: cap > 0 && safeClaimed < cap,
    cap,
    claimed: Math.min(safeClaimed, cap),
    remaining: Math.max(0, cap - safeClaimed),
    tier: BETA_OFFER_TIER,
    durationDays: BETA_OFFER_DURATION_DAYS,
  };
}
