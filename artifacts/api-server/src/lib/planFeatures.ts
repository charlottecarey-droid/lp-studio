import { pool } from "@workspace/db";

/**
 * Canonical plan tiers. The DB column `tenants.plan` is free-form text
 * (kept that way deliberately — no enum migration risk on a live table),
 * so we normalize the raw row value here. Source of truth for both
 * server-side plan gating and the `planFeatures` map surfaced to the
 * client via /api/auth/me.
 *
 * Tier ladder (low → high):
 *   starter  — marketing only, no Sales Console
 *   growth   — marketing + Sales Console
 *   enterprise — everything (SSO/governance/higher quotas land here later)
 */
export type Plan = "starter" | "growth" | "enterprise";

export const PLANS: readonly Plan[] = ["starter", "growth", "enterprise"];

/**
 * Map legacy / inbound plan strings to a canonical tier.
 *
 * IMPORTANT — backwards compatibility: existing tenants run on the
 * pre-rename plan vocabulary ("trial" / "business" / "pro" /
 * "enterprise"). Mapping `trial → growth` (not `starter`) is
 * intentional: trials historically had Sales Console access, and we
 * don't want to silently strip that today. New self-serve signups
 * should be created with `plan = "starter"` explicitly; ops can flip
 * a tenant to "starter" in admin to actually downgrade them.
 */
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

/**
 * Feature flags per canonical plan. Single source of truth — both the
 * `requirePlanFeature` middleware and the client-side `plan-features.ts`
 * mirror read from the same shape. Add a new feature by extending
 * `PlanFeatures`, filling in all three tiers below, and mirroring it on
 * the client.
 *
 * `salesConsole` gates the entire /api/sales/* surface AND the Sales
 * mode toggle in the SaaS UI. `aiImageGen` is a marker for the future
 * unbundling of the AI-image add-on; the existing TOP_TIER_PLANS check
 * in lib/tenantSettings.ts is unchanged for now to avoid disturbing the
 * live image-generation gating.
 */
export interface PlanFeatures {
  salesConsole: boolean;
  aiImageGen: boolean;
}

export const PLAN_FEATURES: Record<Plan, PlanFeatures> = {
  starter:    { salesConsole: false, aiImageGen: false },
  growth:     { salesConsole: true,  aiImageGen: false },
  enterprise: { salesConsole: true,  aiImageGen: true  },
};

export function featuresForPlan(plan: Plan): PlanFeatures {
  return PLAN_FEATURES[plan];
}

/**
 * Look up a tenant's normalized plan. Returns "starter" for an unknown
 * or missing tenant — the safest default (least access). Callers that
 * need the raw DB value should query `tenants.plan` directly.
 */
export async function getTenantPlan(tenantId: number | null | undefined): Promise<Plan> {
  if (tenantId == null) return "starter";
  const r = await pool.query<{ plan: string | null }>(
    `SELECT plan FROM tenants WHERE id = $1`,
    [tenantId],
  );
  return normalizePlan(r.rows[0]?.plan);
}

export async function getTenantPlanFeatures(
  tenantId: number | null | undefined,
): Promise<{ plan: Plan; features: PlanFeatures }> {
  const plan = await getTenantPlan(tenantId);
  return { plan, features: PLAN_FEATURES[plan] };
}
