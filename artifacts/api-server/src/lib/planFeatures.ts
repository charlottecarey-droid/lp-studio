import { pool } from "@workspace/db";
import {
  computeTrialState,
  effectivePlan,
  isProtectedEnterpriseSlug,
  normalizePlan,
  PLAN_FEATURES,
  type Plan,
  type PlanFeatures,
  type TrialState,
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
  TRIAL_TIER,
  TRIAL_DURATION_DAYS,
  isProtectedEnterpriseSlug,
  normalizePlan,
  featuresForPlan,
  effectivePlan,
  computeTrialState,
} from "@workspace/plan-config";
export type { Plan, PlanFeatures, PlanLimits, PlanConfigEntry, TrialState } from "@workspace/plan-config";

/**
 * SQL `SET` fragment that closes an in-progress trial window when a tenant is
 * dropped to the Free floor.
 *
 * Every path that writes `plan = 'free'` (the in-app "downgrade to Free"
 * button, the Stripe cancel/unpaid subscription webhook, and the dunning
 * final-attempt downgrade) MUST include this fragment. Otherwise an open
 * `trial_expires_at` keeps `effectivePlan()` lifting the stored Free floor
 * back up to the Growth trial tier — so a just-downgraded tenant would still
 * resolve to Growth and keep reaching the Sales Console and every other gated
 * feature until the trial date naturally passes.
 *
 * The CASE expressions evaluate against the pre-update row, so this:
 *   • closes a still-open window to `now()` (a past/absent one is untouched), and
 *   • stamps `has_trialed_before` only when a trial actually existed (so a plain
 *     Free tenant doesn't burn a never-used trial).
 *
 * It references only existing columns + `now()`, so it adds no query params and
 * is safe to splice into any `UPDATE tenants SET …` next to the `plan` write.
 */
export const CLOSE_TRIAL_ON_FREE_SQL = `
            trial_expires_at = CASE
              WHEN trial_expires_at IS NOT NULL AND trial_expires_at > now() THEN now()
              ELSE trial_expires_at
            END,
            has_trialed_before = (
              has_trialed_before
              OR trial_started_at IS NOT NULL
              OR trial_expires_at IS NOT NULL
            )`;

/**
 * Look up a tenant's EFFECTIVE plan — the single chokepoint every server-side
 * plan-gate funnels through. Returns "free" for an unknown or missing tenant
 * (the safest default, least access). Callers that need the raw stored value
 * should query `tenants.plan` directly.
 *
 * Trial handling: while a tenant's trial window is open the effective plan is
 * raised to the trial tier (Growth); once it lapses the stored plan stands
 * (auto-downgrade with no data touched). The very first read after expiry
 * also flips `has_trialed_before` so the trial can't be restarted — done
 * lazily here (same pattern as the AI-usage counter) to avoid a cron job.
 */
export async function getTenantPlan(tenantId: number | null | undefined): Promise<Plan> {
  if (tenantId == null) return "free";
  const r = await pool.query<{
    plan: string | null;
    slug: string | null;
    trial_expires_at: Date | string | null;
    has_trialed_before: boolean | null;
  }>(
    `SELECT plan, slug, trial_expires_at, has_trialed_before FROM tenants WHERE id = $1`,
    [tenantId],
  );
  const row = r.rows[0];
  // Dandy safeguard — the two Dandy workspaces always resolve to enterprise,
  // regardless of stored plan or any Stripe webhook. See PROTECTED_ENTERPRISE_SLUGS.
  if (isProtectedEnterpriseSlug(row?.slug)) return "enterprise";

  const stored = normalizePlan(row?.plan);
  const trialExpiresAt = row?.trial_expires_at ?? null;

  // Lazy-on-read: stamp `has_trialed_before` the first time we observe a
  // lapsed trial. Best-effort and idempotent (guarded WHERE) so concurrent
  // reads don't double-write or block the response.
  if (trialExpiresAt && !row?.has_trialed_before) {
    const expired = new Date(trialExpiresAt).getTime() <= Date.now();
    if (expired) void markTrialConsumed(tenantId);
  }

  return effectivePlan({ storedPlan: stored, trialExpiresAt });
}

/**
 * Marks a tenant's trial as consumed (one-time, on expiry). Best-effort: a
 * failure just means the next read retries. This is the natural hook point
 * for a future `trial_expired` lifecycle notification (see notifications
 * follow-up) — emit the event here once the dispatcher exists.
 */
async function markTrialConsumed(tenantId: number): Promise<void> {
  try {
    await pool.query(
      `UPDATE tenants SET has_trialed_before = true WHERE id = $1 AND has_trialed_before = false`,
      [tenantId],
    );
  } catch (err) {
    console.error("[planFeatures] failed to mark trial consumed for tenant", tenantId, err);
  }
}

/**
 * Resolve a tenant's trial snapshot (active / expired / days-remaining) for
 * banner + billing UI. Returns an inert "no trial" state for unknown tenants.
 */
export async function getTenantTrialState(
  tenantId: number | null | undefined,
): Promise<TrialState> {
  const inert: TrialState = {
    active: false,
    expired: false,
    startedAt: null,
    expiresAt: null,
    daysRemaining: 0,
  };
  if (tenantId == null) return inert;
  const r = await pool.query<{
    trial_started_at: Date | string | null;
    trial_expires_at: Date | string | null;
  }>(
    `SELECT trial_started_at, trial_expires_at FROM tenants WHERE id = $1`,
    [tenantId],
  );
  const row = r.rows[0];
  if (!row) return inert;
  return computeTrialState({
    trialStartedAt: row.trial_started_at,
    trialExpiresAt: row.trial_expires_at,
  });
}

/**
 * True when the tenant is one of the protected Dandy workspaces (dandy /
 * dandy-smb). Used to gate Dandy-only built-in one-pager templates on the
 * server publish/save paths. Returns false for unknown/missing tenants
 * (fail closed — non-Dandy tenants must not reach the gated built-ins).
 */
export async function isDandyTenant(tenantId: number | null | undefined): Promise<boolean> {
  if (tenantId == null) return false;
  const r = await pool.query<{ slug: string | null }>(
    `SELECT slug FROM tenants WHERE id = $1`,
    [tenantId],
  );
  return isProtectedEnterpriseSlug(r.rows[0]?.slug);
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
