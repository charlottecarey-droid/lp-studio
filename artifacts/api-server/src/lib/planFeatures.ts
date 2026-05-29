import { pool } from "@workspace/db";
import {
  isProtectedEnterpriseSlug,
  normalizePlan,
  PLAN_FEATURES,
  type Plan,
  type PlanFeatures,
} from "@workspace/plan-config";
import { getPlanFeatures } from "./planConfig";

/**
 * Server-side plan helpers.
 *
 * The canonical tier model (the `Plan` union, `normalizePlan`, the
 * `PLAN_FEATURES` default matrix, the Dandy slug guard) now lives in the
 * shared `@workspace/plan-config` package so the marketing site and the
 * client app can't structurally drift from the backend. This module
 * re-exports those names for existing importers and adds the DB-backed,
 * per-tenant lookups that only make sense server-side.
 *
 * IMPORTANT — `PLAN_FEATURES` re-exported here is the canonical DEFAULT /
 * fallback matrix. The LIVE, SuperAdmin-editable values come from the
 * `plan_config` table via `./planConfig` (`getPlanFeatures`,
 * `getPlanFeaturesMap`). Prefer the async accessors for gating; only use the
 * static map where an async call isn't possible (and accept that it ignores
 * SuperAdmin overrides).
 */
export {
  PLAN_FEATURES,
  PLANS,
  PROTECTED_ENTERPRISE_SLUGS,
  isProtectedEnterpriseSlug,
  normalizePlan,
  featuresForPlan,
} from "@workspace/plan-config";
export type { Plan, PlanFeatures, PlanLimits, PlanConfigEntry } from "@workspace/plan-config";

/**
 * Look up a tenant's normalized plan. Returns "free" for an unknown
 * or missing tenant — the safest default (least access). Callers that
 * need the raw DB value should query `tenants.plan` directly.
 */
export async function getTenantPlan(tenantId: number | null | undefined): Promise<Plan> {
  if (tenantId == null) return "free";
  const r = await pool.query<{ plan: string | null; slug: string | null }>(
    `SELECT plan, slug FROM tenants WHERE id = $1`,
    [tenantId],
  );
  const row = r.rows[0];
  // Dandy safeguard — the two Dandy workspaces always resolve to enterprise,
  // regardless of stored plan or any Stripe webhook. See PROTECTED_ENTERPRISE_SLUGS.
  if (isProtectedEnterpriseSlug(row?.slug)) return "enterprise";
  return normalizePlan(row?.plan);
}

/**
 * Resolve a tenant's plan AND its live (DB-backed, SuperAdmin-editable)
 * feature matrix in one call.
 */
export async function getTenantPlanFeatures(
  tenantId: number | null | undefined,
): Promise<{ plan: Plan; features: PlanFeatures }> {
  const plan = await getTenantPlan(tenantId);
  const features = await getPlanFeatures(plan);
  return { plan, features };
}
