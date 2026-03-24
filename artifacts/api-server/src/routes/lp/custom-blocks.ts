import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

router.get("/lp/custom-blocks", async (_req, res): Promise<void> => {
  try {
    const rows = await db.execute(
      sql`SELECT id, name, block_type, props, sort_order, created_at, updated_at
          FROM lp_custom_blocks
          ORDER BY sort_order ASC, id ASC`
    );
    res.json(rows.rows);
  } catch {
    res.json([]);
  }
});

router.post("/lp/custom-blocks", async (req, res): Promise<void> => {
  const { name, block_type, props } = req.body as { name?: string; block_type?: string; props?: unknown };
  try {
    const result = await db.execute(
      sql`INSERT INTO lp_custom_blocks (name, block_type, props, sort_order)
          VALUES (${name ?? "Untitled Block"}, ${block_type ?? "rich-text"},
                  ${JSON.stringify(props ?? { html: "" })}::jsonb,
                  COALESCE((SELECT MAX(sort_order) + 1 FROM lp_custom_blocks), 0))
          RETURNING *`
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.put("/lp/custom-blocks/:id", async (req, res): Promise<void> => {
  const { id } = req.params;
  const { name, block_type, props } = req.body as { name?: string; block_type?: string; props?: unknown };
  try {
    const result = await db.execute(
      sql`UPDATE lp_custom_blocks
          SET name = ${name ?? "Untitled Block"},
              block_type = ${block_type ?? "rich-text"},
              props = ${JSON.stringify(props ?? { html: "" })}::jsonb,
              updated_at = now()
          WHERE id = ${Number(id)}
          RETURNING *`
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.delete("/lp/custom-blocks/:id", async (req, res): Promise<void> => {
  const { id } = req.params;
  try {
    await db.execute(
      sql`DELETE FROM lp_custom_blocks WHERE id = ${Number(id)}`
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
