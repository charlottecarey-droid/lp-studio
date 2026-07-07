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
 *   brandedEmailSubdomain — Tier 2 email sending: auto-provisioned branded
 *                  subdomain under the platform apex (e.g. mail.<slug>.lpstudio.ai).
 *                  Gates the auto-subdomain provisioning flow (separate task);
 *                  always fails closed to the Tier 1 shared default sender.
 *   customEmailDomain — Tier 3 email sending: the tenant's own fully custom
 *                  sending domain via the self-serve wizard (separate task);
 *                  also fails closed to the Tier 1 shared default sender.
 *   smartTraffic — Smart Traffic routing config (enabling/resetting the
 *                  Thompson-sampling allocator on an A/B test). Visitor-side
 *                  ASSIGNMENT on already-configured tests is never gated —
 *                  published pages keep working after a downgrade; the gate
 *                  is on the tenant-facing config surface.
 *   customBlocks — authoring custom blocks (create / edit / AI generate /
 *                  compose). Reads and deletes stay open so existing pages
 *                  keep rendering and tenants can clean up after downgrade.
 *   programmaticPages — the whole programmatic-pages + DTR-rules surface.
 *   multiWorkspace — creating ADDITIONAL workspaces from an existing one
 *                  (multi-brand). Gates workspace CREATION only; switching
 *                  between workspaces a user is already a member of is never
 *                  gated (invited collaborators keep access regardless of
 *                  either workspace's plan).
 *   limits       — numeric caps (see PlanLimits)
 */
export interface PlanFeatures {
  salesConsole: boolean;
  aiImageGen: boolean;
  customDomain: boolean;
  brandedEmailSubdomain: boolean;
  customEmailDomain: boolean;
  smartTraffic: boolean;
  customBlocks: boolean;
  programmaticPages: boolean;
  multiWorkspace: boolean;
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
      brandedEmailSubdomain: false,
      customEmailDomain: false,
      smartTraffic: false,
      customBlocks: false,
      programmaticPages: false,
      multiWorkspace: false,
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
      brandedEmailSubdomain: false,
      customEmailDomain: false,
      smartTraffic: false,
      customBlocks: false,
      programmaticPages: false,
      multiWorkspace: false,
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
      brandedEmailSubdomain: true,
      customEmailDomain: false,
      smartTraffic: true,
      customBlocks: true,
      programmaticPages: false,
      multiWorkspace: false,
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
      brandedEmailSubdomain: true,
      customEmailDomain: false,
      smartTraffic: true,
      customBlocks: true,
      programmaticPages: true,
      multiWorkspace: true,
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
      brandedEmailSubdomain: true,
      customEmailDomain: true,
      smartTraffic: true,
      customBlocks: true,
      programmaticPages: true,
      multiWorkspace: true,
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

/**
 * TRIALS — every self-serve signup gets the SAME automatic 14-day trial of
 * the Growth tier (no card, no tier picker in onboarding). The trial tier is
 * a constant (not a per-tenant column): trials are uniform. Both values are
 * defaults that can later be surfaced as SuperAdmin-editable settings.
 */
export const TRIAL_TIER: Plan = "growth";
export const TRIAL_DURATION_DAYS = 14;

/** Tier ladder position (low -> high). Used to compare two plans. */
export function planRank(plan: Plan): number {
  return PLAN_CONFIG[plan].sortOrder;
}

/** The higher (more access) of two plans on the tier ladder. */
export function higherPlan(a: Plan, b: Plan): Plan {
  return planRank(a) >= planRank(b) ? a : b;
}

function toDateOrNull(v: Date | string | number | null | undefined): Date | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Resolve a tenant's EFFECTIVE plan from its stored plan + trial window.
 *
 * During an active trial (`trialExpiresAt` in the future) the tenant gets at
 * least the trial tier (Growth); we never DOWNGRADE a higher stored plan
 * (e.g. a Scale customer who happens to carry trial dates). After expiry the
 * stored plan stands — auto-downgrade is purely a function of the clock, no
 * data is touched. This is the single source of truth every plan-gate reads.
 */
export function effectivePlan(args: {
  storedPlan: Plan;
  trialExpiresAt: Date | string | number | null | undefined;
  now?: Date;
}): Plan {
  const expiry = toDateOrNull(args.trialExpiresAt);
  if (!expiry) return args.storedPlan;
  const now = args.now ?? new Date();
  return expiry.getTime() > now.getTime()
    ? higherPlan(args.storedPlan, TRIAL_TIER)
    : args.storedPlan;
}

/** Trial snapshot for banners / billing UI. */
export interface TrialState {
  /** A trial window exists and has not yet ended. */
  active: boolean;
  /** A trial window exists and has ended. */
  expired: boolean;
  startedAt: Date | null;
  expiresAt: Date | null;
  /** Whole days left (ceil) while active; 0 otherwise. */
  daysRemaining: number;
}

export function computeTrialState(args: {
  trialStartedAt: Date | string | number | null | undefined;
  trialExpiresAt: Date | string | number | null | undefined;
  now?: Date;
}): TrialState {
  const startedAt = toDateOrNull(args.trialStartedAt);
  const expiresAt = toDateOrNull(args.trialExpiresAt);
  if (!expiresAt) {
    return { active: false, expired: false, startedAt, expiresAt: null, daysRemaining: 0 };
  }
  const now = args.now ?? new Date();
  const msLeft = expiresAt.getTime() - now.getTime();
  const active = msLeft > 0;
  return {
    active,
    expired: !active,
    startedAt,
    expiresAt,
    daysRemaining: active ? Math.max(1, Math.ceil(msLeft / 86_400_000)) : 0,
  };
}
