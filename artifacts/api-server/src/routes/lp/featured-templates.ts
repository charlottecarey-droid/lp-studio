// Featured homepage templates — superadmin-editable list driving the marketing
// homepage "templates" section (previously a hardcoded TEMPLATES array).
//
//  - GET  /lp/featured-templates           — PUBLIC (CORS), enabled+ordered rows
//                                            for the marketing site.
//  - GET  /admin/lp/featured-templates     — superadmin: ALL rows (incl. disabled).
//  - PUT  /admin/lp/featured-templates     — superadmin: replace the whole list
//                                            (handles add/edit/delete/reorder/toggle
//                                            atomically in one transaction).
//
// The public GET is listed in LP_PUBLIC (routes/index.ts) so it skips the
// blanket /lp/* auth. The admin routes live under /admin/lp/* and are each
// gated by requireSuperadmin directly (mirrors adminTemplates.ts).

import { Router } from "express";
import { pool } from "@workspace/db";
import { requireSuperadmin } from "../../middleware/requireSuperadmin";

const router = Router();

interface FeaturedRow {
  id: number;
  template_id: string;
  title: string;
  description: string;
  thumbnail_url: string;
  category: string;
  blocks_count: number;
  enabled: boolean;
  sort_order: number;
}

// Shape returned to the public marketing site — matches the marketing
// `Template` interface (TemplatesEmbed.tsx): { id, title, description,
// thumbnail, category, blocks }.
function toPublic(r: FeaturedRow) {
  return {
    id: r.template_id,
    title: r.title,
    description: r.description,
    thumbnail: r.thumbnail_url,
    category: r.category,
    blocks: r.blocks_count,
  };
}

// Shape returned to the superadmin editor — every column, so the editor can
// round-trip the full row (incl. enabled + the numeric id for stable keys).
function toAdmin(r: FeaturedRow) {
  return {
    id: r.id,
    templateId: r.template_id,
    title: r.title,
    description: r.description,
    thumbnailUrl: r.thumbnail_url,
    category: r.category,
    blocksCount: r.blocks_count,
    enabled: r.enabled,
    sortOrder: r.sort_order,
  };
}

// GET /lp/featured-templates — PUBLIC. Enabled rows in display order. Returns
// an empty array (not an error) when the table is empty so the marketing site
// can fall back to its built-in list.
router.get("/lp/featured-templates", async (_req, res): Promise<void> => {
  try {
    const r = await pool.query<FeaturedRow>(
      `SELECT id, template_id, title, description, thumbnail_url, category,
              blocks_count, enabled, sort_order
         FROM featured_homepage_templates
        WHERE enabled = true
        ORDER BY sort_order ASC, id ASC`,
    );
    res.json({ templates: r.rows.map(toPublic) });
  } catch (err) {
    console.error("GET /lp/featured-templates error:", String(err));
    res.status(500).json({ error: "Failed to load featured templates" });
  }
});

// GET /lp/global-templates/:id/preview — PUBLIC. Block JSON for a single
// database-backed GLOBAL template (is_global=true AND is_template=true), so the
// marketing homepage's preview iframe (and the superadmin editor's "Preview"
// link) can render featured cards that point at a DB-backed global template
// rather than a built-in flagship one. Only global templates are exposed here —
// they are platform-shared starters already surfaced on the public homepage, so
// serving their blocks anonymously is safe; tenant-owned templates are never
// returned. Allowlisted in routes/index.ts (LP_PUBLIC) so it skips /lp/* auth.
router.get("/lp/global-templates/:id/preview", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid template id" });
    return;
  }
  try {
    const r = await pool.query<{ id: number; title: string; blocks: unknown }>(
      `SELECT id, title, blocks
         FROM lp_pages
        WHERE id = $1 AND is_template = true AND is_global = true`,
      [id],
    );
    if (r.rowCount === 0) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    const row = r.rows[0];
    res.json({
      id: row.id,
      title: row.title,
      blocks: Array.isArray(row.blocks) ? row.blocks : [],
    });
  } catch (err) {
    console.error("GET /lp/global-templates/:id/preview error:", String(err));
    res.status(500).json({ error: "Failed to load template preview" });
  }
});

// GET /admin/lp/featured-templates — superadmin. ALL rows, including disabled.
router.get("/admin/lp/featured-templates", requireSuperadmin, async (_req, res): Promise<void> => {
  try {
    const r = await pool.query<FeaturedRow>(
      `SELECT id, template_id, title, description, thumbnail_url, category,
              blocks_count, enabled, sort_order
         FROM featured_homepage_templates
        ORDER BY sort_order ASC, id ASC`,
    );
    res.json({ templates: r.rows.map(toAdmin) });
  } catch (err) {
    console.error("GET /admin/lp/featured-templates error:", String(err));
    res.status(500).json({ error: "Failed to load featured templates" });
  }
});

interface IncomingEntry {
  templateId?: unknown;
  title?: unknown;
  description?: unknown;
  thumbnailUrl?: unknown;
  category?: unknown;
  blocksCount?: unknown;
  enabled?: unknown;
}

// PUT /admin/lp/featured-templates — superadmin. Replace the entire list with
// the provided array (in order). This is the simplest correct model for a
// small, fully superadmin-owned list: add/edit/delete/reorder/enable-disable
// all collapse into "save the new list". Done in a transaction so a partial
// write can never leave the homepage half-updated.
router.put("/admin/lp/featured-templates", requireSuperadmin, async (req, res): Promise<void> => {
  const body = req.body ?? {};
  const incoming: unknown = body.templates;
  if (!Array.isArray(incoming)) {
    res.status(400).json({ error: "templates must be an array" });
    return;
  }

  // Validate + normalize every entry before touching the DB so a bad row
  // rejects the whole save instead of writing a partial list.
  const rows: {
    templateId: string;
    title: string;
    description: string;
    thumbnailUrl: string;
    category: string;
    blocksCount: number;
    enabled: boolean;
  }[] = [];

  for (let i = 0; i < incoming.length; i++) {
    const e = incoming[i] as IncomingEntry;
    const templateId = typeof e.templateId === "string" ? e.templateId.trim() : "";
    if (!templateId) {
      res.status(400).json({ error: `Entry ${i + 1}: templateId is required` });
      return;
    }
    const blocksRaw = e.blocksCount;
    const blocksCount =
      blocksRaw === undefined || blocksRaw === null || blocksRaw === ""
        ? 0
        : Number(blocksRaw);
    if (!Number.isFinite(blocksCount) || blocksCount < 0) {
      res.status(400).json({ error: `Entry ${i + 1}: blocksCount must be a non-negative number` });
      return;
    }
    rows.push({
      templateId,
      title: typeof e.title === "string" ? e.title : "",
      description: typeof e.description === "string" ? e.description : "",
      thumbnailUrl: typeof e.thumbnailUrl === "string" ? e.thumbnailUrl.trim() : "",
      category: typeof e.category === "string" ? e.category : "",
      blocksCount: Math.trunc(blocksCount),
      enabled: e.enabled === undefined ? true : Boolean(e.enabled),
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM featured_homepage_templates");
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      await client.query(
        `INSERT INTO featured_homepage_templates
           (template_id, title, description, thumbnail_url, category, blocks_count, enabled, sort_order, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          row.templateId,
          row.title,
          row.description,
          row.thumbnailUrl,
          row.category,
          row.blocksCount,
          row.enabled,
          i,
        ],
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("PUT /admin/lp/featured-templates error:", String(err));
    res.status(500).json({ error: "Failed to save featured templates" });
    return;
  } finally {
    client.release();
  }

  try {
    const r = await pool.query<FeaturedRow>(
      `SELECT id, template_id, title, description, thumbnail_url, category,
              blocks_count, enabled, sort_order
         FROM featured_homepage_templates
        ORDER BY sort_order ASC, id ASC`,
    );
    res.json({ templates: r.rows.map(toAdmin) });
  } catch (err) {
    console.error("PUT /admin/lp/featured-templates reload error:", String(err));
    res.status(500).json({ error: "Saved, but failed to reload" });
  }
});

export default router;
