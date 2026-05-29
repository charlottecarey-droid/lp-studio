import { pool } from "@workspace/db";

/**
 * Count a tenant's AI generations in the current calendar month.
 *
 * Source of truth is `ai_generation_log`, which is written one-row-per call to
 * `/lp/generate-page`. Kept in its own module so the AI-quota gate can be
 * unit-tested by mocking this function without colliding with the unrelated
 * `pool` reads inside `getPlanConfig`.
 */
export async function countTenantAiGenerationsThisMonth(tenantId: number): Promise<number> {
  const r = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM ai_generation_log
      WHERE tenant_id = $1 AND created_at >= date_trunc('month', now())`,
    [tenantId],
  );
  return Number(r.rows[0]?.n ?? 0);
}
