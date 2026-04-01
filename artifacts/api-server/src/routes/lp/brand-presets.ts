import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

router.get("/lp/brand-presets", async (req, res): Promise<void> => {
  const tenantId = req.authUser?.tenantId ?? 1;
  try {
    const rows = await db.execute(
      sql`SELECT id, name, config, created_at FROM lp_brand_presets WHERE tenant_id = ${tenantId} ORDER BY created_at DESC`
    );
    res.json(rows.rows);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post("/lp/brand-presets", async (req, res): Promise<void> => {
  const tenantId = req.authUser?.tenantId ?? 1;
  const { name, config } = req.body as { name: string; config: unknown };
  if (!name || typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  if (!config || typeof config !== "object") {
    res.status(400).json({ error: "config is required" });
    return;
  }
  try {
    const rows = await db.execute(
      sql`INSERT INTO lp_brand_presets (tenant_id, name, config) VALUES (${tenantId}, ${name.trim()}, ${JSON.stringify(config)}::jsonb) RETURNING id, name, config, created_at`
    );
    res.status(201).json(rows.rows[0]);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post("/lp/brand-presets/:id/load", async (req, res): Promise<void> => {
  const tenantId = req.authUser?.tenantId ?? 1;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    const rows = await db.execute(
      sql`SELECT id, name, config, created_at FROM lp_brand_presets WHERE id = ${id} AND tenant_id = ${tenantId}`
    );
    if (!rows.rows.length) {
      res.status(404).json({ error: "Preset not found" });
      return;
    }
    res.json(rows.rows[0]);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.delete("/lp/brand-presets/:id", async (req, res): Promise<void> => {
  const tenantId = req.authUser?.tenantId ?? 1;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    const result = await db.execute(
      sql`DELETE FROM lp_brand_presets WHERE id = ${id} AND tenant_id = ${tenantId} RETURNING id`
    );
    if (!result.rows.length) {
      res.status(404).json({ error: "Preset not found" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
