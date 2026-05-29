import { pool } from "@workspace/db";

/**
 * Heatmap ingestion is a public, visitor-facing collector — there is no
 * `authUser` to read a tenant from, so we resolve the owning tenant via the
 * page the events belong to. `lp_heatmap_events` has no tenant_id column; it
 * joins to `lp_pages` on page_id.
 *
 * Both reads live here (not inline in the route) so the heatmap session-quota
 * gate can be unit-tested by mocking this module, leaving `getPlanConfig`'s
 * own `pool` usage untouched.
 */

export async function resolveTenantIdForPage(pageId: number): Promise<number | null> {
  const r = await pool.query<{ tenant_id: number | null }>(
    `SELECT tenant_id FROM lp_pages WHERE id = $1`,
    [pageId],
  );
  const t = r.rows[0]?.tenant_id;
  return t == null ? null : Number(t);
}

/** Distinct heatmap sessions recorded for a tenant in the current month. */
export async function countTenantHeatmapSessionsThisMonth(tenantId: number): Promise<number> {
  const r = await pool.query<{ n: string }>(
    `SELECT COUNT(DISTINCT h.session_id)::text AS n
       FROM lp_heatmap_events h
       JOIN lp_pages p ON p.id = h.page_id
      WHERE p.tenant_id = $1
        AND h.created_at >= date_trunc('month', now())`,
    [tenantId],
  );
  return Number(r.rows[0]?.n ?? 0);
}
