/**
 * Client-side mirror of `artifacts/api-server/src/lib/planFeatures.ts`.
 *
 * Keep the `Plan` union, the legacy→canonical mapping in
 * `normalizePlan`, and the `PLAN_FEATURES` matrix below in lockstep
 * with the server file — both reference the same conceptual source of
 * truth, just duplicated across the artifact boundary because
 * lp-studio doesn't import @workspace/api-server.
 *
 * The /api/auth/me response surfaces a server-computed `planFeatures`
 * object so this file never has to call the server, but we still
 * compute features locally as a fallback for sessions issued before
 * the field existed.
 */
export type Plan = "starter" | "growth" | "enterprise";

export interface PlanLimits {
  pages: number | null;
  forms: number | null;
  userSeats: number | null;
}

export interface PlanFeatures {
  salesConsole: boolean;
  aiImageGen: boolean;
  customDomain: boolean;
  limits: PlanLimits;
}

export const PLAN_FEATURES: Record<Plan, PlanFeatures> = {
  starter: {
    salesConsole: false,
    aiImageGen: false,
    customDomain: false,
    limits: { pages: 5, forms: 2, userSeats: 3 },
  },
  growth: {
    salesConsole: true,
    aiImageGen: false,
    customDomain: true,
    limits: { pages: null, forms: null, userSeats: 10 },
  },
  enterprise: {
    salesConsole: true,
    aiImageGen: true,
    customDomain: true,
    limits: { pages: null, forms: null, userSeats: null },
  },
};

export function normalizePlan(raw: string | null | undefined): Plan {
  switch ((raw ?? "").toLowerCase()) {
    case "starter":
      return "starter";
    case "growth":
    case "business":
    case "trial":
      return "growth";
    case "pro":
    case "enterprise":
      return "enterprise";
    default:
      return "starter";
  }
}

export function featuresForPlan(plan: Plan): PlanFeatures {
  return PLAN_FEATURES[plan];
}

/**
 * Resolve plan features for a user object from AuthContext. Prefers the
 * server-computed `planFeatures` from /auth/me; falls back to
 * recomputing from the legacy `tenantPlan` string for sessions issued
 * before that field existed; finally falls back to the most restrictive
 * tier (starter) when no user is present at all.
 *
 * Single consolidated fallback chain so every consumer (mode toggle,
 * route guard, future feature gates) reaches the same conclusion.
 */
export function resolveFeatures(
  user: { planFeatures?: PlanFeatures | null; tenantPlan?: string | null } | null | undefined,
): PlanFeatures {
  if (user?.planFeatures) return user.planFeatures;
  return featuresForPlan(normalizePlan(user?.tenantPlan));
}
