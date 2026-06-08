import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAuth } from "../middleware/requireAuth";
import { requireSuperadmin } from "../middleware/requireSuperadmin";
import { getTenantIndustry as tenantIndustry, VALID_INDUSTRIES as INDUSTRY_SET } from "../lib/tenantIndustry";
import { sanitizeRoleTags } from "@workspace/lp-template-engine";
import { ensureSystemTenant } from "../lib/systemTenant";

const router = Router();

const VALID_INDUSTRIES = INDUSTRY_SET;

// ─── Authenticated: tenant-aware catalog read ───────────────────────────────
// GET /api/block-catalog
//   Always returns rows for the *caller's tenant industry*. The optional
//   `?industry=` query is honored ONLY for superadmins (preview/debug).
//   Frontend merges DB partials on top of in-code BLOCK_REGISTRY defaults.
router.get("/block-catalog", requireAuth, async (req, res): Promise<void> => {
  const user = req.authUser!;
  // Industry is always derived from the caller's tenant. Cross-industry
  // browsing for superadmins is exposed only via the separate /admin
  // endpoints (gated by ADMIN_PASSWORD). Tenant admins (user.isAdmin == true
  // for their own tenant) MUST NOT be able to read another industry's catalog.
  const industry = await tenantIndustry(user.tenantId);
  try {
    const result = await pool.query(
      `SELECT block_type, industry, label, category, tags, default_props, is_enabled, ai_enabled, sort_order, updated_at
       FROM block_catalog WHERE industry = $1
       ORDER BY sort_order ASC, label ASC`,
      [industry]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("[block-catalog] GET error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── Superadmin: full CRUD ───────────────────────────────────────────────────

// GET /api/admin/block-catalog — list all rows (every industry)
router.get("/admin/block-catalog", requireSuperadmin, async (_req, res): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT block_type, industry, label, category, tags, default_props, is_enabled, ai_enabled, sort_order, updated_at, updated_by
       FROM block_catalog ORDER BY industry, sort_order, label`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("[block-catalog admin] GET error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Shared upsert used by both the single PUT and the batch endpoint. Returns
// `{ ok: true, row }` on success or `{ ok: false, error }` on a validation or
// DB failure so callers can report partial outcomes without throwing.
type CatalogUpsertInput = {
  block_type?: unknown;
  industry?: unknown;
  label?: unknown;
  category?: unknown;
  tags?: unknown;
  default_props?: unknown;
  is_enabled?: unknown;
  ai_enabled?: unknown;
  sort_order?: unknown;
};
type CatalogUpsertResult =
  | { ok: true; row: any }
  | { ok: false; error: string };

async function upsertCatalogRow(input: CatalogUpsertInput): Promise<CatalogUpsertResult> {
  const { block_type, industry, label, category, tags, default_props, is_enabled, ai_enabled, sort_order } = input;
  if (!block_type || !industry || !label || !category) {
    return { ok: false, error: "block_type, industry, label, category required" };
  }
  if (!VALID_INDUSTRIES.has(industry as never)) {
    return { ok: false, error: "Invalid industry" };
  }
  // Role tags are validated against the controlled vocabulary; unknown/invalid
  // entries are dropped (fail-closed). An empty array clears the override so
  // the block falls back to its in-code default tags.
  const cleanTags = sanitizeRoleTags(tags as never);
  try {
    const result = await pool.query(
      `INSERT INTO block_catalog (block_type, industry, label, category, tags, default_props, is_enabled, ai_enabled, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, true), COALESCE($8, true), COALESCE($9, 0))
       ON CONFLICT (block_type, industry) DO UPDATE SET
         label = EXCLUDED.label,
         category = EXCLUDED.category,
         tags = EXCLUDED.tags,
         default_props = EXCLUDED.default_props,
         is_enabled = EXCLUDED.is_enabled,
         ai_enabled = EXCLUDED.ai_enabled,
         sort_order = EXCLUDED.sort_order,
         updated_at = now()
       RETURNING *`,
      [block_type, industry, label, category, cleanTags, JSON.stringify(default_props ?? {}), is_enabled, ai_enabled, sort_order]
    );
    return { ok: true, row: result.rows[0] };
  } catch (err: any) {
    console.error("[block-catalog admin] upsert error:", err);
    return { ok: false, error: err?.message || "Server error" };
  }
}

// PUT /api/admin/block-catalog — upsert a row
// Body: { block_type, industry, label, category, default_props, is_enabled?, sort_order? }
router.put("/admin/block-catalog", requireSuperadmin, async (req, res): Promise<void> => {
  const result = await upsertCatalogRow(req.body ?? {});
  if (!result.ok) {
    // Preserve prior status semantics: validation errors → 400, DB errors → 500.
    const isValidation =
      result.error === "block_type, industry, label, category required" ||
      result.error === "Invalid industry";
    res.status(isValidation ? 400 : 500).json({ error: result.error });
    return;
  }
  res.json(result.row);
});

// PUT /api/admin/block-catalog/batch — upsert many rows in a single request.
// Body: { rows: Array<{ block_type, industry, label, category, ... }> }
//
// Each row is upserted independently with bounded concurrency. The endpoint
// always returns 200 (unless the body itself is malformed) and reports a
// per-row outcome so the caller can surface partial failures (which blocks
// failed and why) exactly like the previous one-request-per-block loop.
const BATCH_MAX_ROWS = 1000;
const BATCH_CONCURRENCY = 16;

router.put("/admin/block-catalog/batch", requireSuperadmin, async (req, res): Promise<void> => {
  const rows = (req.body as { rows?: unknown })?.rows;
  if (!Array.isArray(rows)) {
    res.status(400).json({ error: "rows array required" });
    return;
  }
  if (rows.length === 0) {
    res.json({ updated: 0, failed: 0, results: [] });
    return;
  }
  if (rows.length > BATCH_MAX_ROWS) {
    res.status(400).json({ error: `Too many rows (max ${BATCH_MAX_ROWS})` });
    return;
  }
  const inputs: unknown[] = rows;

  // Stable per-row result objects, filled as each upsert settles. Index keeps
  // the response aligned with the request order regardless of completion order.
  const results: Array<{
    index: number;
    block_type: string | null;
    industry: string | null;
    ok: boolean;
    error?: string;
  }> = new Array(inputs.length);

  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < inputs.length) {
      const i = cursor++;
      const input = (inputs[i] ?? {}) as CatalogUpsertInput;
      const blockType = typeof input.block_type === "string" ? input.block_type : null;
      const industry = typeof input.industry === "string" ? input.industry : null;
      const r = await upsertCatalogRow(input);
      results[i] = r.ok
        ? { index: i, block_type: blockType, industry, ok: true }
        : { index: i, block_type: blockType, industry, ok: false, error: r.error };
    }
  }

  const workers = Array.from({ length: Math.min(BATCH_CONCURRENCY, rows.length) }, () => worker());
  await Promise.all(workers);

  const updated = results.filter(r => r.ok).length;
  res.json({ updated, failed: results.length - updated, results });
});

// DELETE /api/admin/block-catalog/:blockType/:industry — remove a row
router.delete("/admin/block-catalog/:blockType/:industry", requireSuperadmin, async (req, res): Promise<void> => {
  const blockType = String(req.params["blockType"] ?? "");
  const industry = String(req.params["industry"] ?? "");
  if (!VALID_INDUSTRIES.has(industry as never)) { res.status(400).json({ error: "Invalid industry" }); return; }
  try {
    const result = await pool.query(
      `DELETE FROM block_catalog WHERE block_type = $1 AND industry = $2 RETURNING block_type`,
      [blockType, industry]
    );
    res.json({ deleted: result.rowCount ?? 0 });
  } catch (err) {
    console.error("[block-catalog admin] DELETE error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/admin/block-catalog/duplicate — copy a row to another industry
// Body: { block_type, from_industry, to_industry }
router.post("/admin/block-catalog/duplicate", requireSuperadmin, async (req, res): Promise<void> => {
  const { block_type, from_industry, to_industry } = req.body ?? {};
  if (!block_type || !from_industry || !to_industry) {
    res.status(400).json({ error: "block_type, from_industry, to_industry required" });
    return;
  }
  if (!VALID_INDUSTRIES.has(from_industry) || !VALID_INDUSTRIES.has(to_industry)) {
    res.status(400).json({ error: "Invalid industry" });
    return;
  }
  try {
    const src = await pool.query(
      `SELECT label, category, tags, default_props, is_enabled, ai_enabled, sort_order FROM block_catalog
       WHERE block_type = $1 AND industry = $2`,
      [block_type, from_industry]
    );
    if (!src.rows.length) { res.status(404).json({ error: "Source row not found" }); return; }
    const r = src.rows[0];
    const result = await pool.query(
      `INSERT INTO block_catalog (block_type, industry, label, category, tags, default_props, is_enabled, ai_enabled, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (block_type, industry) DO UPDATE SET
         label = EXCLUDED.label, category = EXCLUDED.category, tags = EXCLUDED.tags,
         default_props = EXCLUDED.default_props, is_enabled = EXCLUDED.is_enabled,
         ai_enabled = EXCLUDED.ai_enabled,
         sort_order = EXCLUDED.sort_order, updated_at = now()
       RETURNING *`,
      [block_type, to_industry, r.label, r.category, sanitizeRoleTags(r.tags), JSON.stringify(r.default_props), r.is_enabled, r.ai_enabled, r.sort_order]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("[block-catalog admin] duplicate error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── Superadmin: visual block-default editor (task #1026) ────────────────────
//
// The Block Catalog tab lets a superadmin edit a global block default visually
// in the existing page builder instead of hand-editing JSON. The flow:
//   1. POST /admin/block-catalog/scratch-page — seed a single-block scratch page
//      owned by the system tenant, pre-filled with the catalog row's *effective*
//      default props (registry default merged under the DB override, computed
//      client-side since BLOCK_REGISTRY lives only in the lp-studio frontend).
//      The catalog context (block_type, industry, label, category) rides along
//      in page_variables.__catalog* so the builder can detect "catalog mode" and
//      route Save back to the catalog rather than the page.
//   2. The builder opens at /builder/:id (superadmin GET/PUT on lp_pages already
//      bypass tenant ownership for app superadmins).
//   3. PUT /admin/block-catalog/default-props — write the edited block props
//      back to block_catalog.default_props for (block_type, industry),
//      preserving label/category/tags/is_enabled/ai_enabled/sort_order on an
//      existing row.

// POST /admin/block-catalog/scratch-page
// Body: { block_type, industry, label?, category?, props? }
router.post("/admin/block-catalog/scratch-page", requireSuperadmin, async (req, res): Promise<void> => {
  const { block_type, industry, label, category, props } = req.body ?? {};
  if (!block_type || !industry) {
    res.status(400).json({ error: "block_type and industry required" });
    return;
  }
  if (!VALID_INDUSTRIES.has(industry)) {
    res.status(400).json({ error: "Invalid industry" });
    return;
  }
  const cleanProps =
    props && typeof props === "object" && !Array.isArray(props) ? (props as Record<string, unknown>) : {};
  const safeLabel = typeof label === "string" && label.trim() ? label.trim() : String(block_type);
  const safeCategory = typeof category === "string" && category.trim() ? category.trim() : "Content";
  try {
    const tenantId = await ensureSystemTenant();
    // Deterministic slug so re-opening the same (block_type, industry) reuses one
    // scratch page rather than accumulating throwaways. Re-seeded on every open.
    const slug = `__catalog-${industry}-${block_type}`.slice(0, 255);
    const blockId = `${block_type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const blocks = [{ id: blockId, type: block_type, props: cleanProps }];
    const pageVariables = {
      __catalog: "1",
      __catalogBlockType: String(block_type),
      __catalogIndustry: String(industry),
      __catalogLabel: safeLabel,
      __catalogCategory: safeCategory,
    };
    const title = `Catalog · ${safeLabel} (${industry})`;
    const actor = req.authUser?.email ?? null;
    const result = await pool.query<{ id: number }>(
      `INSERT INTO lp_pages (tenant_id, title, slug, blocks, status, mode, page_variables, created_by, updated_by)
       VALUES ($1, $2, $3, $4, 'draft', 'marketing', $5, $6, $6)
       ON CONFLICT (tenant_id, slug) DO UPDATE SET
         title = EXCLUDED.title,
         blocks = EXCLUDED.blocks,
         page_variables = EXCLUDED.page_variables,
         updated_by = EXCLUDED.updated_by,
         updated_at = now()
       RETURNING id`,
      [tenantId, title, slug, JSON.stringify(blocks), JSON.stringify(pageVariables), actor]
    );
    res.json({ pageId: result.rows[0].id });
  } catch (err: any) {
    console.error("[block-catalog admin] scratch-page error:", err);
    res.status(500).json({ error: err?.message || "Server error" });
  }
});

// PUT /admin/block-catalog/default-props
// Body: { block_type, industry, default_props, label?, category? }
// Writes the visually-edited block props back to the catalog. On an existing
// row only default_props/updated_by/updated_at change; label/category/tags/
// is_enabled/ai_enabled/sort_order are preserved. On a brand-new row the
// provided label/category seed it (mirrors "create override on first save").
router.put("/admin/block-catalog/default-props", requireSuperadmin, async (req, res): Promise<void> => {
  const { block_type, industry, default_props, label, category } = req.body ?? {};
  if (!block_type || !industry) {
    res.status(400).json({ error: "block_type and industry required" });
    return;
  }
  if (!VALID_INDUSTRIES.has(industry)) {
    res.status(400).json({ error: "Invalid industry" });
    return;
  }
  const cleanProps =
    default_props && typeof default_props === "object" && !Array.isArray(default_props)
      ? (default_props as Record<string, unknown>)
      : {};
  const newLabel = typeof label === "string" && label.trim() ? label.trim() : String(block_type);
  const newCategory = typeof category === "string" && category.trim() ? category.trim() : "Content";
  // updated_by is an INTEGER column (app user id), not an email string.
  const updatedBy = req.authUser?.userId ?? null;
  try {
    const result = await pool.query(
      `INSERT INTO block_catalog (block_type, industry, label, category, default_props, is_enabled, ai_enabled, sort_order, updated_by)
       VALUES ($1, $2, $3, $4, $5, true, true, 0, $6)
       ON CONFLICT (block_type, industry) DO UPDATE SET
         default_props = EXCLUDED.default_props,
         updated_by = EXCLUDED.updated_by,
         updated_at = now()
       RETURNING *`,
      [block_type, industry, newLabel, newCategory, JSON.stringify(cleanProps), updatedBy]
    );
    res.json(result.rows[0]);
  } catch (err: any) {
    console.error("[block-catalog admin] default-props error:", err);
    res.status(500).json({ error: err?.message || "Server error" });
  }
});

export default router;
