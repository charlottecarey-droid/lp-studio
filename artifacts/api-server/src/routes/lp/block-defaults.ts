import { getTenantId } from "../../middleware/requireAuth";
import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

const KNOWN_BLOCK_TYPES = new Set([
  "hero", "photo-strip", "nav-header", "footer", "full-bleed-hero",
  "pas-section", "comparison", "benefits-grid", "how-it-works",
  "product-grid", "video-section", "resources", "rich-text", "custom-html",
  "zigzag-features", "product-showcase", "trust-bar", "testimonials",
  "faq", "cta-banner", "cta-strip", "process-steps",
  "stat-callout", "testimonial", "case-studies", "bottom-cta", "cta-button",
]);

router.get("/lp/block-defaults", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    const rows = await db.execute(
      sql`SELECT block_type, props, block_settings FROM lp_block_defaults WHERE tenant_id = ${tenantId} ORDER BY block_type`
    );
    const result: Record<string, { props: unknown; blockSettings: unknown }> = {};
    for (const row of rows.rows as { block_type: string; props: unknown; block_settings: unknown }[]) {
      result[row.block_type] = { props: row.props, blockSettings: row.block_settings ?? {} };
    }
    res.json(result);
  } catch {
    res.json({});
  }
});

router.put("/lp/block-defaults/:blockType", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const { blockType } = req.params;
  if (!KNOWN_BLOCK_TYPES.has(blockType)) {
    res.status(400).json({ error: `Unknown block type: ${blockType}` });
    return;
  }
  const { props, blockSettings = {} } = req.body as { props: unknown; blockSettings?: unknown };
  try {
    await db.execute(
      sql`INSERT INTO lp_block_defaults (tenant_id, block_type, props, block_settings, updated_at)
          VALUES (${tenantId}, ${blockType}, ${JSON.stringify(props)}::jsonb, ${JSON.stringify(blockSettings)}::jsonb, now())
          ON CONFLICT (tenant_id, block_type)
          DO UPDATE SET props = ${JSON.stringify(props)}::jsonb, block_settings = ${JSON.stringify(blockSettings)}::jsonb, updated_at = now()`
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.delete("/lp/block-defaults/:blockType", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const { blockType } = req.params;
  if (!KNOWN_BLOCK_TYPES.has(blockType)) {
    res.status(400).json({ error: `Unknown block type: ${blockType}` });
    return;
  }
  try {
    await db.execute(
      sql`DELETE FROM lp_block_defaults WHERE block_type = ${blockType} AND tenant_id = ${tenantId}`
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
