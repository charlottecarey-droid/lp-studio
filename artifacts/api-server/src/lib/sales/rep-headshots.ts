/**
 * Load the rep-headshot index from the Sales Reps library.
 *
 * Query only — the matching rules live in `rep-headshot-match.ts` so they can
 * be unit tested without a database.
 */
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { buildHeadshotIndex, type HeadshotIndex } from "./rep-headshot-match";

export { attachHeadshots, countHeadshotMatches, buildHeadshotIndex } from "./rep-headshot-match";
export type { HeadshotIndex, HeadshotTarget } from "./rep-headshot-match";

/**
 * Built once per request rather than per person — an account team of eight
 * would otherwise be eight round trips.
 */
export async function loadHeadshotIndex(tenantId: number): Promise<HeadshotIndex> {
  const rows = await db.execute(
    sql`SELECT content FROM lp_library_items
        WHERE tenant_id = ${tenantId} AND type = 'team_member'`,
  );
  return buildHeadshotIndex(
    (rows.rows as { content?: unknown }[]).map((r) => (r.content ?? {}) as Record<string, unknown>),
  );
}
