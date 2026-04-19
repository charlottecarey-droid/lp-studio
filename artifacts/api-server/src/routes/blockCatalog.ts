import { Router } from "express";
import crypto from "crypto";
import { pool } from "@workspace/db";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

const VALID_INDUSTRIES = new Set(["dental", "generic"]);

/** Read the canonical industry for a tenant from tenants.settings.industry. Defaults to 'dental'. */
async function tenantIndustry(tenantId: number | null | undefined): Promise<"dental" | "generic"> {
  if (tenantId == null) return "dental";
  const r = await pool.query(`SELECT settings FROM tenants WHERE id = $1`, [tenantId]);
  const ind = r.rows[0]?.settings?.industry;
  return ind === "generic" ? "generic" : "dental";
}

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
      `SELECT block_type, industry, label, category, default_props, is_enabled, sort_order, updated_at
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
function requireAdminKey(req: any, res: any, next: any): void {
  const key = req.headers["x-admin-key"];
  if (!process.env.ADMIN_PASSWORD) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { timingSafeEqual } = crypto;
  const keyBuf = Buffer.from((key ? String(key) : "").padEnd(64, '\0'));
  const envBuf = Buffer.from(process.env.ADMIN_PASSWORD.padEnd(64, '\0'));
  let ok = false;
  try { ok = timingSafeEqual(keyBuf, envBuf); } catch { ok = false; }
  if (!ok) { res.status(401).json({ error: "Unauthorized" }); return; }
  next();
}

// GET /api/admin/block-catalog — list all rows (every industry)
router.get("/admin/block-catalog", requireAdminKey, async (_req, res): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT block_type, industry, label, category, default_props, is_enabled, sort_order, updated_at, updated_by
       FROM block_catalog ORDER BY industry, sort_order, label`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("[block-catalog admin] GET error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /api/admin/block-catalog — upsert a row
// Body: { block_type, industry, label, category, default_props, is_enabled?, sort_order? }
router.put("/admin/block-catalog", requireAdminKey, async (req, res): Promise<void> => {
  const { block_type, industry, label, category, default_props, is_enabled, sort_order } = req.body ?? {};
  if (!block_type || !industry || !label || !category) {
    res.status(400).json({ error: "block_type, industry, label, category required" });
    return;
  }
  if (!VALID_INDUSTRIES.has(industry)) {
    res.status(400).json({ error: "Invalid industry" });
    return;
  }
  try {
    const result = await pool.query(
      `INSERT INTO block_catalog (block_type, industry, label, category, default_props, is_enabled, sort_order)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, true), COALESCE($7, 0))
       ON CONFLICT (block_type, industry) DO UPDATE SET
         label = EXCLUDED.label,
         category = EXCLUDED.category,
         default_props = EXCLUDED.default_props,
         is_enabled = EXCLUDED.is_enabled,
         sort_order = EXCLUDED.sort_order,
         updated_at = now()
       RETURNING *`,
      [block_type, industry, label, category, JSON.stringify(default_props ?? {}), is_enabled, sort_order]
    );
    res.json(result.rows[0]);
  } catch (err: any) {
    console.error("[block-catalog admin] PUT error:", err);
    res.status(500).json({ error: err.message || "Server error" });
  }
});

// DELETE /api/admin/block-catalog/:blockType/:industry — remove a row
router.delete("/admin/block-catalog/:blockType/:industry", requireAdminKey, async (req, res): Promise<void> => {
  const { blockType, industry } = req.params;
  if (!VALID_INDUSTRIES.has(industry)) { res.status(400).json({ error: "Invalid industry" }); return; }
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
router.post("/admin/block-catalog/duplicate", requireAdminKey, async (req, res): Promise<void> => {
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
      `SELECT label, category, default_props, is_enabled, sort_order FROM block_catalog
       WHERE block_type = $1 AND industry = $2`,
      [block_type, from_industry]
    );
    if (!src.rows.length) { res.status(404).json({ error: "Source row not found" }); return; }
    const r = src.rows[0];
    const result = await pool.query(
      `INSERT INTO block_catalog (block_type, industry, label, category, default_props, is_enabled, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (block_type, industry) DO UPDATE SET
         label = EXCLUDED.label, category = EXCLUDED.category,
         default_props = EXCLUDED.default_props, is_enabled = EXCLUDED.is_enabled,
         sort_order = EXCLUDED.sort_order, updated_at = now()
       RETURNING *`,
      [block_type, to_industry, r.label, r.category, JSON.stringify(r.default_props), r.is_enabled, r.sort_order]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("[block-catalog admin] duplicate error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
