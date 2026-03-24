import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

router.get("/lp/block-defaults", async (_req, res): Promise<void> => {
  try {
    const rows = await db.execute(
      sql`SELECT block_type, props FROM lp_block_defaults ORDER BY block_type`
    );
    const result: Record<string, unknown> = {};
    for (const row of rows.rows as { block_type: string; props: unknown }[]) {
      result[row.block_type] = row.props;
    }
    res.json(result);
  } catch {
    res.json({});
  }
});

router.put("/lp/block-defaults/:blockType", async (req, res): Promise<void> => {
  const { blockType } = req.params;
  const { props } = req.body as { props: unknown };
  try {
    await db.execute(
      sql`INSERT INTO lp_block_defaults (block_type, props, updated_at)
          VALUES (${blockType}, ${JSON.stringify(props)}::jsonb, now())
          ON CONFLICT (block_type)
          DO UPDATE SET props = ${JSON.stringify(props)}::jsonb, updated_at = now()`
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.delete("/lp/block-defaults/:blockType", async (req, res): Promise<void> => {
  const { blockType } = req.params;
  try {
    await db.execute(
      sql`DELETE FROM lp_block_defaults WHERE block_type = ${blockType}`
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
