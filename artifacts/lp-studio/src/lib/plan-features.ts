/**
 * Client-side plan helpers.
 *
 * The canonical tier model (the `Plan` union, the legacy→canonical
 * `normalizePlan` mapping, the `PLAN_FEATURES` matrix, `PLAN_CONFIG` with
 * display names / prices) now lives in the shared `@workspace/plan-config`
 * package, imported by the backend, this app, AND the marketing pricing
 * page. That makes structural drift across the artifact boundary impossible
 * — there is only one matrix.
 *
 * The /api/auth/me response still surfaces a server-computed `planFeatures`
 * object so gating reflects live SuperAdmin edits; the shared map here is the
 * fallback for sessions issued before that field existed.
 */
export {
  PLAN_CONFIG,
  PLAN_FEATURES,
  PLANS,
  normalizePlan,
  featuresForPlan,
  configForPlan,
} from "@workspace/plan-config";
export type {
  Plan,
  PlanLimits,
  PlanFeatures,
  PlanConfigEntry,
} from "@workspace/plan-config";

import { featuresForPlan, normalizePlan, type PlanFeatures } from "@workspace/plan-config";

/**
 * Resolve plan features for a user object from AuthContext. Prefers the
 * server-computed `planFeatures` from /auth/me; falls back to recomputing
 * from the legacy `tenantPlan` string for sessions issued before that field
 * existed; finally falls back to the most restrictive tier (free) when no
 * user is present at all.
 *
 * Single consolidated fallback chain so every consumer (mode toggle, route
 * guard, future feature gates) reaches the same conclusion.
 */
export function resolveFeatures(
  user: { planFeatures?: PlanFeatures | null; tenantPlan?: string | null } | null | undefined,
): PlanFeatures {
  if (user?.planFeatures) return user.planFeatures;
  return featuresForPlan(normalizePlan(user?.tenantPlan));
}
