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
