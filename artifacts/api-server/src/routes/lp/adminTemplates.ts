// Superadmin endpoints for managing the global template library.
// These endpoints let the superadmin promote any tenant-owned template to a
// global template (visible cross-tenant, scoped by industry), demote it back,
// or change its industry tag and label.

import { Router } from "express";
import { pool } from "@workspace/db";
import { requireSuperadmin } from "../../middleware/requireSuperadmin";
import { VALID_INDUSTRIES } from "../../lib/tenantIndustry";

const router = Router();

interface TemplateRow {
  id: number;
  tenant_id: number;
  tenant_name: string | null;
  tenant_slug: string | null;
  title: string;
  slug: string;
  template_label: string | null;
  template_description: string | null;
  status: string;
  mode: string;
  block_count: number;
  is_global: boolean;
  industry: string | null;
  updated_at: string;
}

// GET /api/admin/lp/templates — list every template across every tenant,
// joined with the owning tenant's name/slug for display.
router.get("/admin/lp/templates", requireSuperadmin, async (_req, res): Promise<void> => {
  try {
    const r = await pool.query<TemplateRow>(`
      SELECT
        p.id,
        p.tenant_id,
        t.name AS tenant_name,
        t.slug AS tenant_slug,
        p.title,
        p.slug,
        p.template_label,
        p.template_description,
        p.status,
        p.mode,
        COALESCE(jsonb_array_length(p.blocks), 0)::int AS block_count,
        p.is_global,
        p.industry,
        p.updated_at
      FROM lp_pages p
      LEFT JOIN tenants t ON t.id = p.tenant_id
      WHERE p.is_template = true
      ORDER BY p.is_global DESC, p.industry NULLS LAST, p.template_label NULLS LAST, p.title
    `);
    res.json(r.rows);
  } catch (err) {
    console.error("GET /admin/lp/templates error:", String(err));
    res.status(500).json({ error: "Failed to load templates" });
  }
});

// PUT /api/admin/lp/templates/:id — update a template's superadmin-managed
// fields: is_global, industry, template_label, template_description.
// Body: { is_global?: boolean, industry?: "dental" | "generic" | null,
//         template_label?: string, template_description?: string }
router.put("/admin/lp/templates/:id", requireSuperadmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const { is_global, industry, template_label, template_description } = req.body ?? {};

  if (industry !== undefined && industry !== null && !VALID_INDUSTRIES.has(industry)) {
    res.status(400).json({ error: `industry must be null, 'dental', or 'generic'` });
    return;
  }
  if (is_global !== undefined && typeof is_global !== "boolean") {
    res.status(400).json({ error: "is_global must be boolean" });
    return;
  }
  if (template_label !== undefined && typeof template_label !== "string") {
    res.status(400).json({ error: "template_label must be a string" });
    return;
  }
  if (template_description !== undefined && typeof template_description !== "string") {
    res.status(400).json({ error: "template_description must be a string" });
    return;
  }

  // Build a dynamic SET clause so unspecified fields are left untouched.
  const sets: string[] = [];
  const params: any[] = [];
  let i = 1;
  if (is_global !== undefined)            { sets.push(`is_global = $${i++}`);            params.push(is_global); }
  if (industry !== undefined)             { sets.push(`industry = $${i++}`);             params.push(industry); }
  if (template_label !== undefined)       { sets.push(`template_label = $${i++}`);       params.push(template_label); }
  if (template_description !== undefined) { sets.push(`template_description = $${i++}`); params.push(template_description); }
  if (sets.length === 0) {
    res.status(400).json({ error: "Nothing to update" });
    return;
  }
  sets.push(`updated_at = NOW()`);
  params.push(id);

  try {
    const r = await pool.query(
      `UPDATE lp_pages SET ${sets.join(", ")} WHERE id = $${i} AND is_template = true
       RETURNING id, is_global, industry, template_label, template_description`,
      params,
    );
    if (r.rowCount === 0) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    res.json(r.rows[0]);
  } catch (err) {
    console.error("PUT /admin/lp/templates/:id error:", String(err));
    res.status(500).json({ error: "Update failed" });
  }
});

export default router;
