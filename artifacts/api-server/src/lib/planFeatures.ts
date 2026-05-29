import { pool } from "@workspace/db";

/**
 * Canonical plan tiers. The DB column `tenants.plan` is free-form text
 * (kept that way deliberately — no enum migration risk on a live table),
 * so we normalize the raw row value here. Source of truth for both
 * server-side plan gating and the `planFeatures` map surfaced to the
 * client via /api/auth/me.
 *
 * Tier ladder (low → high):
 *   free       — marketing only, 1 page/form, no Sales Console, "Powered by" badge
 *   starter    — paid floor: more pages/forms, no badge, still no Sales Console
 *   growth     — marketing + Sales Console + custom domain, generous caps
 *   scale      — growth + AI image generation, higher seat cap
 *   enterprise — everything: no count caps (sales-assisted)
 *
 * NOTE — these hardcoded defaults are the SEED + FALLBACK values. Phase 1
 * moves the per-tier caps/flags into a SuperAdmin-editable config; until
 * then this map is the live source of truth.
 */
export type Plan = "free" | "starter" | "growth" | "scale" | "enterprise";

export const PLANS: readonly Plan[] = ["free", "starter", "growth", "scale", "enterprise"];

/**
 * Tenant slugs that must ALWAYS resolve to enterprise, regardless of the
 * stored `tenants.plan` value or any Stripe webhook. The two Dandy
 * workspaces are sales-assisted (no Stripe subscription) and must never be
 * downgraded by the tier reconciliation. Matched by slug (not id) so the
 * guard is environment-independent (dev vs prod tenant ids differ).
 */
export const PROTECTED_ENTERPRISE_SLUGS: readonly string[] = ["dandy", "dandy-smb"];

export function isProtectedEnterpriseSlug(slug: string | null | undefined): boolean {
  return !!slug && PROTECTED_ENTERPRISE_SLUGS.includes(slug.toLowerCase());
}

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
    case "free":
      return "free";
    case "starter":
      // NOTE — post-reconciliation `starter` is the PAID floor. Legacy
      // free-floor tenants that stored `starter` are rewritten to `free`
      // by migration 0035, so any remaining `starter` here is the paid
      // tier (set by Stripe checkout / superadmin).
      return "starter";
    case "growth":
    case "business":
    case "trial":
      return "growth";
    case "scale":
      return "scale";
    case "pro":
    case "enterprise":
      return "enterprise";
    default:
      return "free";
  }
}

/**
 * Per-tier numeric caps. `null` means unlimited.
 *
 *   pages     — non-template landing pages a tenant can have
 *   forms     — lp_forms rows a tenant can have
 *   userSeats — accepted tenant_members (counted incl. pending invites)
 *
 * Gates fail closed (402 `plan_upgrade_required`) when the tenant is at
 * or above the cap. Existing tenants run on legacy plans ("trial" →
 * growth) so they hit the unlimited bucket; only fresh starter signups
 * see the caps today.
 */
export interface PlanLimits {
  pages: number | null;
  forms: number | null;
  userSeats: number | null;
}

/**
 * Feature flags per canonical plan. Single source of truth — both the
 * `requirePlanFeature` middleware and the client-side `plan-features.ts`
 * mirror read from the same shape. Add a new feature by extending
 * `PlanFeatures`, filling in all three tiers below, and mirroring it on
 * the client.
 *
 *   salesConsole — entire /api/sales/* surface + Sales mode toggle
 *   aiImageGen   — custom-block & out-of-builder AI image generation
 *   customDomain — attaching `domain` / `microsite_domain` to a tenant
 *   limits       — numeric caps (see PlanLimits)
 */
export interface PlanFeatures {
  salesConsole: boolean;
  aiImageGen: boolean;
  customDomain: boolean;
  limits: PlanLimits;
}

export const PLAN_FEATURES: Record<Plan, PlanFeatures> = {
  free: {
    salesConsole: false,
    aiImageGen: false,
    customDomain: false,
    limits: { pages: 1, forms: 1, userSeats: 1 },
  },
  starter: {
    salesConsole: false,
    aiImageGen: false,
    customDomain: false,
    limits: { pages: 10, forms: 5, userSeats: 3 },
  },
  growth: {
    salesConsole: true,
    aiImageGen: false,
    customDomain: true,
    limits: { pages: null, forms: null, userSeats: 10 },
  },
  scale: {
    salesConsole: true,
    aiImageGen: true,
    customDomain: true,
    limits: { pages: null, forms: null, userSeats: 25 },
  },
  enterprise: {
    salesConsole: true,
    aiImageGen: true,
    customDomain: true,
    limits: { pages: null, forms: null, userSeats: null },
  },
};

export function featuresForPlan(plan: Plan): PlanFeatures {
  return PLAN_FEATURES[plan];
}

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

export async function getTenantPlanFeatures(
  tenantId: number | null | undefined,
): Promise<{ plan: Plan; features: PlanFeatures }> {
  const plan = await getTenantPlan(tenantId);
  return { plan, features: PLAN_FEATURES[plan] };
}
