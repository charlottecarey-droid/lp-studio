/** Load the rep directory (Sales Reps library) for a tenant. Matching rules: rep-directory-match.ts. */
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { buildRepDirectory, resolveRepRecipient, type RepDirectory } from "./rep-directory-match";

export { buildRepDirectory, fillRepVariables, findRepEmailField, resolveRepRecipient, REP_VARIABLES } from "./rep-directory-match";
export type { RepDirectory, RepProfile } from "./rep-directory-match";

export async function loadRepDirectory(tenantId: number): Promise<RepDirectory> {
  const rows = await db.execute(
    sql`SELECT content FROM lp_library_items
        WHERE tenant_id = ${tenantId} AND type = 'team_member'
        ORDER BY sort_order ASC, id ASC`,
  );
  return buildRepDirectory((rows.rows as { content?: unknown }[]).map((r) => (r.content ?? {}) as Record<string, unknown>));
}

/**
 * Lead notifications: the rep a submission names (its "Rep email" field),
 * when that rep is in the tenant's Sales Reps library; null otherwise.
 * Skips the library query entirely when no such field was submitted.
 */
export async function resolveRepRecipientForTenant(tenantId: number, fields: Record<string, unknown>): Promise<string | null> {
  const hasRepField = Object.keys(fields).some((k) => /rep|owner/i.test(k) && /e-?mail/i.test(k));
  if (!hasRepField) return null;
  return resolveRepRecipient(fields, await loadRepDirectory(tenantId));
}
