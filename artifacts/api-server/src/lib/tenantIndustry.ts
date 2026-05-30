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

/**
 * Topic keywords that bias generated-page image relevance scoring toward
 * on-topic imagery for a given industry. Sourced here (industry config)
 * rather than as a literal string inside the page generator so that adding a
 * new industry only touches this one file, and so the relevance bias stays in
 * lockstep with the rest of the per-industry experience (block catalog,
 * templates) that already keys off `Industry`.
 *
 * `generic` intentionally contributes no keywords: a generic tenant's only
 * topic signal is its own generation prompt, never an assumed vertical. This
 * preserves the safety contract in `getTenantIndustry` — we never inject
 * dental (or any vertical) bias into a non-dental tenant's pages.
 */
const INDUSTRY_IMAGE_KEYWORDS: Record<Industry, readonly string[]> = {
  dental: [
    "dental",
    "dentistry",
    "dentist",
    "clinic",
    "teeth",
    "smile",
    "patient",
    "dentures",
    "orthodontic",
    "hygiene",
  ],
  generic: [],
};

/**
 * On-topic keywords for an industry, used to bias image relevance scoring.
 * Returns an empty array for `generic` (prompt is the only topic signal).
 */
export function getIndustryImageKeywords(industry: Industry): readonly string[] {
  return INDUSTRY_IMAGE_KEYWORDS[industry] ?? [];
}
