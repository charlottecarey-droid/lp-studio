import { pool } from "@workspace/db";
import type { AudienceRole } from "./workflowTypes";

/**
 * Audience role resolution (Task #626).
 *
 * Maps an `AudienceRole` to the set of active app_users it targets. The three
 * buckets PARTITION the active-user population:
 *
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

/** Count of deliverable users in the given role bucket. */
export async function countAudience(role: AudienceRole): Promise<number> {
  const r = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM app_users u WHERE ${DELIVERABLE} AND (${rolePredicate(role)})`,
  );
  return r.rows[0]?.n ?? 0;
}

/**
 * Deliverable recipients in the role bucket, ordered by id and capped at `limit`
 * (the producer passes the 10k per-tick cap). Ordering by id keeps successive
 * ticks stable so the same first-N are produced before any overflow.
 */
export async function listAudienceRecipients(
  role: AudienceRole,
  limit: number,
): Promise<AudienceRecipient[]> {
  const r = await pool.query<{ id: number; email: string; name: string | null; tenant_id: number | null }>(
    `SELECT u.id, u.email, u.name, u.tenant_id
       FROM app_users u
      WHERE ${DELIVERABLE} AND (${rolePredicate(role)})
      ORDER BY u.id
      LIMIT $1`,
    [limit],
  );
  return r.rows.map((row) => ({
    appUserId: row.id,
    email: row.email,
    name: row.name,
    tenantId: row.tenant_id,
  }));
}

/** A small preview sample for the admin UI (count + first few addresses). */
export async function previewAudience(
  role: AudienceRole,
  sampleSize = 8,
): Promise<{ count: number; sample: { email: string; name: string | null }[] }> {
  const [count, recipients] = await Promise.all([
    countAudience(role),
    listAudienceRecipients(role, sampleSize),
  ]);
  return { count, sample: recipients.map((r) => ({ email: r.email, name: r.name })) };
}
