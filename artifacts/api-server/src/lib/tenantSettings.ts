import { pool } from "@workspace/db";

/**
 * Tenant-wide page-review-workflow toggle (task #113).
 *
 * When TRUE (default for tenants that existed before the toggle landed),
 * editors must Submit-for-Review and a reviewer must Approve before a page
 * goes live — the original task #108 behaviour.
 *
 * When FALSE (default for tenants created after the toggle landed), the
 * Submit-for-Review / Approve / Reject UI is hidden, the Pending Review
 * widget is hidden, and any user with the basic `pages` permission can
 * publish directly. The submit-review / approve / reject / pending-review
 * endpoints all return 409 in this mode for defence-in-depth.
 *
 * Reads from tenants.settings JSONB. We never invent the value at read time —
 * if the key is missing we treat it as TRUE (preserving the historical
 * behaviour for any tenant the boot backfill hasn't yet touched).
 */
export async function tenantRequiresReview(
  tenantId: number | null | undefined,
): Promise<boolean> {
  if (tenantId == null) return true;
  const r = await pool.query<{ settings: { requireReviewBeforePublish?: unknown } | null }>(
    `SELECT settings FROM tenants WHERE id = $1`,
    [tenantId],
  );
  const raw = r.rows[0]?.settings?.requireReviewBeforePublish;
  // Only an explicit `false` opts a tenant out. Anything else (true, missing,
  // null, malformed) keeps the safe-by-default review-required behaviour.
  return raw !== false;
}

/**
 * Tenant-wide AI image generation toggle (task #219 follow-up).
 *
 * AI image generation in the custom-block flow is a paid, top-tier-only
 * feature. Two gates apply:
 *
 *   1. The tenant's `plan` must be one of TOP_TIER_PLANS — otherwise the
 *      feature is "unavailable" and cannot be turned on at all.
 *   2. The tenant must have explicitly flipped `settings.aiImageGenEnabled`
 *      to true. Defaults to false even on top-tier plans, so we never
 *      silently spend image-API credits.
 *
 * `available` lets the UI surface an upgrade prompt; `enabled` is the gate
 * the backend image-generation routes use to decide whether to honour a
 * request.
 */
export const TOP_TIER_PLANS: ReadonlySet<string> = new Set(["pro", "enterprise"]);

export interface AiImageGenStatus {
  /** True when the tenant's plan permits the feature (regardless of toggle). */
  available: boolean;
  /** True when the tenant has the feature both available AND turned on. */
  enabled: boolean;
  /** Raw plan value, surfaced for upgrade messaging. */
  plan: string;
}

export async function getAiImageGenStatus(
  tenantId: number | null | undefined,
): Promise<AiImageGenStatus> {
  if (tenantId == null) return { available: false, enabled: false, plan: "" };
  const r = await pool.query<{ plan: string | null; settings: { aiImageGenEnabled?: unknown } | null }>(
    `SELECT plan, settings FROM tenants WHERE id = $1`,
    [tenantId],
  );
  const row = r.rows[0];
  if (!row) return { available: false, enabled: false, plan: "" };
  const plan = row.plan ?? "trial";
  const available = TOP_TIER_PLANS.has(plan);
  const enabled = available && row.settings?.aiImageGenEnabled === true;
  return { available, enabled, plan };
}
