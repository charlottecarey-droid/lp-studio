import { pool } from "@workspace/db";
import type { AudienceFilter, AudienceRole } from "./workflowTypes";

/**
 * Audience resolution (Task #626, extended in Task #661).
 *
 * An `AudienceFilter` resolves to the set of deliverable active app_users it
 * targets. `role` is the coarse population bucket; `plan` / `tenantId` /
 * `role_names` are optional AND-narrowing dimensions (see workflowTypes.ts).
 *
 * Role buckets:
 *   - everyone   — every deliverable active user (no role narrowing).
 *   - superadmin — app_users.role = 'superadmin'. This is the canonical
 *     Dandy-operator flag (see middleware/requireSuperadmin.ts). We deliberately
 *     do NOT use the legacy `tenant_id IS NULL` heuristic: in the live data 45
 *     users have a NULL tenant_id but only one is a superadmin, so that test
 *     would blast a "superadmin" send to dozens of regular users.
 *   - admin — NOT a superadmin, AND a member of some tenant via a role with
 *     is_admin = true (tenant_members → tenant_roles).
 *   - member — everyone else: regular members and users with no membership.
 *
 * Only status = 'active' users with a non-empty email are ever returned, since a
 * resolved recipient must be deliverable.
 */

export interface AudienceRecipient {
  appUserId: number;
  email: string;
  name: string | null;
  tenantId: number | null;
}

const ADMIN_MEMBERSHIP_EXISTS = `EXISTS (
  SELECT 1 FROM tenant_members tm
    JOIN tenant_roles tr ON tr.id = tm.role_id
   WHERE tm.user_id = u.id AND tr.is_admin = true
)`;

/** SQL predicate (on alias `u` = app_users) selecting the role's population. */
function rolePredicate(role: AudienceRole): string {
  switch (role) {
    case "everyone":
      return `true`;
    case "superadmin":
      return `u.role = 'superadmin'`;
    case "admin":
      return `u.role <> 'superadmin' AND ${ADMIN_MEMBERSHIP_EXISTS}`;
    case "member":
      return `u.role <> 'superadmin' AND NOT ${ADMIN_MEMBERSHIP_EXISTS}`;
    default:
      // Unreachable for a validated AudienceRole; fail closed to an empty set.
      return `false`;
  }
}

const DELIVERABLE = `u.status = 'active' AND u.email IS NOT NULL AND u.email <> ''`;

/**
 * SQL expression for a user's EFFECTIVE plan, mirroring the server-side
 * `getTenantPlan` chokepoint (planFeatures.ts) so a plan-targeted send hits the
 * exact same population a per-recipient "plan" condition would:
 *   - the two Dandy workspaces always resolve to enterprise (slug guard);
 *   - a user with no home tenant resolves to free;
 *   - an open trial window lifts a free/starter floor up to the growth trial
 *     tier (a higher stored plan is never downgraded);
 *   - otherwise the stored plan stands (constrained to the canonical 5 tiers by
 *     the tenants_plan_canonical_check constraint).
 * Evaluated against a LEFT JOIN of `tenants t` on `t.id = u.tenant_id`.
 */
const EFFECTIVE_PLAN_SQL = `(
  CASE
    WHEN t.slug IN ('dandy', 'dandy-smb') THEN 'enterprise'
    WHEN t.id IS NULL THEN 'free'
    WHEN t.trial_expires_at IS NOT NULL AND t.trial_expires_at > now()
         AND COALESCE(t.plan, 'free') IN ('free', 'starter') THEN 'growth'
    ELSE COALESCE(t.plan, 'free')
  END
)`;

const FROM_CLAUSE = `app_users u LEFT JOIN tenants t ON t.id = u.tenant_id`;

/**
 * Build the parameterized WHERE clause + bind values for an audience filter.
 * The role bucket + deliverability are always applied; each optional dimension
 * appends an AND predicate with its own bind param so a request can never inject
 * SQL through a plan name, tenant id, or role name.
 */
function buildAudienceWhere(filter: AudienceFilter): { where: string; params: unknown[] } {
  const clauses: string[] = [DELIVERABLE, `(${rolePredicate(filter.role)})`];
  const params: unknown[] = [];
  if (filter.tenantId != null) {
    params.push(filter.tenantId);
    clauses.push(`u.tenant_id = $${params.length}`);
  }
  if (filter.plan) {
    params.push(filter.plan);
    clauses.push(`${EFFECTIVE_PLAN_SQL} = $${params.length}`);
  }
  if (filter.role_names && filter.role_names.length > 0) {
    params.push(filter.role_names.map((n) => n.toLowerCase()));
    clauses.push(`EXISTS (
      SELECT 1 FROM tenant_members tm2
        JOIN tenant_roles tr2 ON tr2.id = tm2.role_id
       WHERE tm2.user_id = u.id AND lower(tr2.name) = ANY($${params.length}::text[])
    )`);
  }
  return { where: clauses.join(" AND "), params };
}

/**
 * Max recipients enrolled per workflow per tick. A configuration whose LIVE
 * audience exceeds this is refused outright (no enrollment) rather than
 * partially blasting the first N — see the producers. Lives here so both the
 * producers and the preview endpoint share one source of truth.
 */
export const AUDIENCE_CAP = 10_000;

/** Count of deliverable users matching the audience filter. */
export async function countAudience(filter: AudienceFilter): Promise<number> {
  const { where, params } = buildAudienceWhere(filter);
  const r = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM ${FROM_CLAUSE} WHERE ${where}`,
    params,
  );
  return r.rows[0]?.n ?? 0;
}

/**
 * Deliverable recipients matching the filter, ordered by id and capped at
 * `limit` (the producer passes the 10k per-tick cap). Ordering by id keeps
 * successive ticks stable so the same first-N are produced before any overflow.
 */
export async function listAudienceRecipients(
  filter: AudienceFilter,
  limit: number,
): Promise<AudienceRecipient[]> {
  const { where, params } = buildAudienceWhere(filter);
  params.push(limit);
  const r = await pool.query<{ id: number; email: string; name: string | null; tenant_id: number | null }>(
    `SELECT u.id, u.email, u.name, u.tenant_id
       FROM ${FROM_CLAUSE}
      WHERE ${where}
      ORDER BY u.id
      LIMIT $${params.length}`,
    params,
  );
  return r.rows.map((row) => ({
    appUserId: row.id,
    email: row.email,
    name: row.name,
    tenantId: row.tenant_id,
  }));
}

/**
 * A small preview sample for the admin UI (count + first few addresses). Also
 * reports the per-tick cap and whether the live audience exceeds it, so the
 * composer can warn that the configuration would be refused at enrollment time.
 */
export async function previewAudience(
  filter: AudienceFilter,
  sampleSize = 8,
): Promise<{
  count: number;
  sample: { email: string; name: string | null }[];
  cap: number;
  overCap: boolean;
}> {
  const [count, recipients] = await Promise.all([
    countAudience(filter),
    listAudienceRecipients(filter, sampleSize),
  ]);
  return {
    count,
    sample: recipients.map((r) => ({ email: r.email, name: r.name })),
    cap: AUDIENCE_CAP,
    overCap: count > AUDIENCE_CAP,
  };
}
