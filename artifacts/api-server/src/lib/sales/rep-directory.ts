/** Load the rep directory (Sales Reps library) for a tenant. Matching rules: rep-directory-match.ts. */
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { buildRepDirectory, type RepDirectory } from "./rep-directory-match";

export { buildRepDirectory, fillRepVariables, REP_VARIABLES } from "./rep-directory-match";
export type { RepDirectory, RepProfile } from "./rep-directory-match";

export async function loadRepDirectory(tenantId: number): Promise<RepDirectory> {
  const rows = await db.execute(
    sql`SELECT content FROM lp_library_items
        WHERE tenant_id = ${tenantId} AND type = 'team_member'
        ORDER BY sort_order ASC, id ASC`,
  );
  return buildRepDirectory((rows.rows as { content?: unknown }[]).map((r) => (r.content ?? {}) as Record<string, unknown>));
}
