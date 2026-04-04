import { getTenantId } from "../../middleware/requireAuth";
import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

router.get("/lp/custom-blocks", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    const rows = await db.execute(
      sql`SELECT id, name, block_type, props, block_settings, segment, sort_order, created_at, updated_at
          FROM lp_custom_blocks
          WHERE tenant_id = ${tenantId}
          ORDER BY sort_order ASC, id ASC`
    );
    res.json(rows.rows);
  } catch {
    res.json([]);
  }
});

router.post("/lp/custom-blocks", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const { name, block_type, props, block_settings, segment } = req.body as {
    name?: string;
    block_type?: string;
    props?: unknown;
    block_settings?: unknown;
    segment?: string;
  };
  const resolvedType = (block_type ?? "rich-text").trim();
  if (!resolvedType) {
    res.status(400).json({ error: "block_type is required" });
    return;
  }
  const resolvedSegment = segment === "segment" ? "segment" : "core";
  try {
    const result = await db.execute(
      sql`INSERT INTO lp_custom_blocks (tenant_id, name, block_type, props, block_settings, segment, sort_order)
          VALUES (${tenantId}, ${name ?? "Untitled Block"}, ${resolvedType},
                  ${JSON.stringify(props ?? {})}::jsonb,
                  ${JSON.stringify(block_settings ?? {})}::jsonb,
                  ${resolvedSegment},
                  COALESCE((SELECT MAX(sort_order) + 1 FROM lp_custom_blocks WHERE tenant_id = ${tenantId}), 0))
          RETURNING *`
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.put("/lp/custom-blocks/:id", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const { id } = req.params;
  const { name, block_type, props, block_settings, segment } = req.body as {
    name?: string;
    block_type?: string;
    props?: unknown;
    block_settings?: unknown;
    segment?: string;
  };
  const resolvedType = (block_type ?? "rich-text").trim();
  if (!resolvedType) {
    res.status(400).json({ error: "block_type is required" });
    return;
  }
  const resolvedSegment = segment === "segment" ? "segment" : "core";
  try {
    const result = await db.execute(
      sql`UPDATE lp_custom_blocks
          SET name = ${name ?? "Untitled Block"},
              block_type = ${resolvedType},
              props = ${JSON.stringify(props ?? {})}::jsonb,
              block_settings = ${JSON.stringify(block_settings ?? {})}::jsonb,
              segment = ${resolvedSegment},
              updated_at = now()
          WHERE id = ${Number(id)} AND tenant_id = ${tenantId}
          RETURNING *`
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.delete("/lp/custom-blocks/:id", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const { id } = req.params;
  try {
    await db.execute(
      sql`DELETE FROM lp_custom_blocks WHERE id = ${Number(id)} AND tenant_id = ${tenantId}`
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
