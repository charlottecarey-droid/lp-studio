/**
 * Canonical plan/pricing configuration — the SINGLE source of truth shared
 * across the artifact boundary.
 *
 * Both `@workspace/api-server` (server-side gating + DB seed) and
 * `@workspace/lp-studio` (client fallback + marketing pricing page) import
 * from here, so the marketing promises, the client-side feature checks, and
 * the server-side 402 gates can never structurally drift.
 *
 * RUNTIME OVERRIDES: this module holds the DEFAULTS. The backend seeds a
 * `plan_config` DB table from these values and reads it through a cached
 * accessor (`artifacts/api-server/src/lib/planConfig.ts`); SuperAdmin edits
 * mutate that table, so the live app reflects edits within the cache TTL.
 * These defaults remain the seed + the fallback whenever the DB row is
 * missing or unavailable. The static (prerendered) marketing page consumes
 * these defaults directly at build time — a drift test guards that the two
 * stay aligned.
 *
 * Tier ladder (low -> high):
 *   free       — marketing only, 1 page/form, no Sales Console, "Powered by" badge
 *   starter    — paid floor: more pages/forms, no badge, still no Sales Console
 *   growth     — marketing + Sales Console + custom domain, generous caps
 *   scale      — growth + AI image generation, higher seat cap
 *   enterprise — everything: no count caps (sales-assisted)
 */

export type Plan = "free" | "starter" | "growth" | "scale" | "enterprise";

export const PLANS: readonly Plan[] = ["free", "starter", "growth", "scale", "enterprise"];

/**
 * Tenant slugs that must ALWAYS resolve to enterprise, regardless of the
 * stored `tenants.plan` value or any Stripe webhook. The two Dandy
 * workspaces are sales-assisted (no Stripe subscription) and must never be
 * downgraded. Matched by slug (not id) so the guard is environment-
 * independent (dev vs prod tenant ids differ).
 */
export const PROTECTED_ENTERPRISE_SLUGS: readonly string[] = ["dandy", "dandy-smb"];

export function isProtectedEnterpriseSlug(slug: string | null | undefined): boolean {
  return !!slug && PROTECTED_ENTERPRISE_SLUGS.includes(slug.toLowerCase());
}

/**
 * Per-tier numeric caps. `null` means unlimited.
 *
 *   pages                  — non-template landing pages a tenant can have
 *   forms                  — lp_forms rows a tenant can have
 *   userSeats              — accepted tenant_members (incl. pending invites)
 *   aiGenerationsPerMonth  — AI copy generations per calendar month
 *   heatmapSessionsPerMonth — heatmap-recorded sessions per calendar month
 *
 * Gates fail closed (402 `plan_upgrade_required`) when at/above the cap.
 * `aiGenerationsPerMonth` / `heatmapSessionsPerMonth` are data-only in
 * Phase 1 (advertised on the pricing page, stored in config); their
 * enforcement lands in Phase 4.
 */
export interface PlanLimits {
  pages: number | null;
  forms: number | null;
  userSeats: number | null;
  aiGenerationsPerMonth: number | null;
  heatmapSessionsPerMonth: number | null;
}

/**
 * Feature flags + caps per canonical plan.
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

/**
 * Full per-tier config row: presentation (display name, prices, ordering)
 * plus the enforceable feature/cap matrix. This is the shape mirrored by
 * the `plan_config` DB table and editable in SuperAdmin.
 *
 *   priceMonthly — USD/month on month-to-month billing; null = sales-only
 *   priceAnnual  — USD/month-equivalent when prepaid annually; null = sales-only
 *   selfServe    — purchasable via Stripe Checkout (vs. sales-assisted)
 *   sortOrder    — display order, low -> high
 */
export interface PlanConfigEntry {
  tier: Plan;
  displayName: string;
  priceMonthly: number | null;
  priceAnnual: number | null;
  selfServe: boolean;
  sortOrder: number;
  features: PlanFeatures;
}

export const PLAN_CONFIG: Record<Plan, PlanConfigEntry> = {
  free: {
    tier: "free",
    displayName: "Free",
    priceMonthly: 0,
    priceAnnual: 0,
    selfServe: true,
    sortOrder: 0,
    features: {
      salesConsole: false,
      aiImageGen: false,
      customDomain: false,
      limits: {
        pages: 1,
        forms: 1,
        userSeats: 1,
        aiGenerationsPerMonth: 30,
        heatmapSessionsPerMonth: 1000,
      },
    },
  },
  starter: {
    tier: "starter",
    displayName: "Starter",
    priceMonthly: 59,
    priceAnnual: 49,
    selfServe: true,
    sortOrder: 1,
    features: {
      salesConsole: false,
      aiImageGen: false,
      customDomain: true,
      limits: {
        pages: 10,
        forms: 5,
        userSeats: 3,
        aiGenerationsPerMonth: 200,
        heatmapSessionsPerMonth: 5000,
      },
    },
  },
  growth: {
    tier: "growth",
    displayName: "Growth",
    priceMonthly: 249,
    priceAnnual: 199,
    selfServe: true,
    sortOrder: 2,
    features: {
      salesConsole: true,
      aiImageGen: false,
      customDomain: true,
      limits: {
        pages: null,
        forms: null,
        userSeats: 10,
        aiGenerationsPerMonth: null,
        heatmapSessionsPerMonth: 25000,
      },
    },
  },
  scale: {
    tier: "scale",
    displayName: "Scale",
    priceMonthly: 649,
    priceAnnual: 499,
    selfServe: true,
    sortOrder: 3,
    features: {
      salesConsole: true,
      aiImageGen: true,
      customDomain: true,
      limits: {
        pages: null,
        forms: null,
        userSeats: 25,
        aiGenerationsPerMonth: null,
        heatmapSessionsPerMonth: 100000,
      },
    },
  },
  enterprise: {
    tier: "enterprise",
    displayName: "Enterprise",
    priceMonthly: null,
    priceAnnual: null,
    selfServe: false,
    sortOrder: 4,
    features: {
      salesConsole: true,
      aiImageGen: true,
      customDomain: true,
      limits: {
        pages: null,
        forms: null,
        userSeats: null,
        aiGenerationsPerMonth: null,
        heatmapSessionsPerMonth: null,
      },
    },
  },
};

/**
 * Derived map of just the enforceable feature/cap matrix per tier. Kept as a
 * named export because most gating consumers only care about features, not
 * presentation. Always reflects PLAN_CONFIG.
 */
export const PLAN_FEATURES: Record<Plan, PlanFeatures> = Object.fromEntries(
  PLANS.map((p) => [p, PLAN_CONFIG[p].features]),
) as Record<Plan, PlanFeatures>;

/**
 * Map legacy / inbound plan strings to a canonical tier.
 *
 * IMPORTANT — backwards compatibility: existing tenants run on the
 * pre-rename plan vocabulary ("trial" / "business" / "pro"). Mapping
 * `trial -> growth` (not `starter`) is intentional: trials historically had
 * Sales Console access. Legacy free-floor `starter` rows were rewritten to
 * `free` by migration 0035, so any `starter` here is the new PAID tier.
 * Unknown / null fails closed to `free` (least access).
 */
export function normalizePlan(raw: string | null | undefined): Plan {
  switch ((raw ?? "").toLowerCase()) {
    case "free":
      return "free";
    case "starter":
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

export function featuresForPlan(plan: Plan): PlanFeatures {
  return PLAN_FEATURES[plan];
}

export function configForPlan(plan: Plan): PlanConfigEntry {
  return PLAN_CONFIG[plan];
}
