import { pool } from "@workspace/db";

/**
 * Read the canonical industry for a tenant from tenants.settings.industry.
 * Defaults to 'generic' — only an explicit 'dental' value resolves to the
 * dental experience. This is the safety contract: a missing / unknown value
 * must never expose dental-only content to a non-Dandy tenant.
 *
 * Used by the block catalog (per-industry block defaults) and by the
 * template marketplace (per-industry global templates).
 */
export type Industry = "dental" | "generic";

export async function getTenantIndustry(tenantId: number | null | undefined): Promise<Industry> {
  if (tenantId == null) return "generic";
  const r = await pool.query(`SELECT settings FROM tenants WHERE id = $1`, [tenantId]);
  const ind = r.rows[0]?.settings?.industry;
  return ind === "dental" ? "dental" : "generic";
}

export const VALID_INDUSTRIES: ReadonlySet<Industry> = new Set(["dental", "generic"] as const);
