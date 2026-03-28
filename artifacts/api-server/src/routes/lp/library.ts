import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

const VALID_TYPES = ["product_showcase", "product_grid", "case_study", "resource", "team_member"] as const;
type LibraryType = typeof VALID_TYPES[number];

function isValidType(t: string): t is LibraryType {
  return (VALID_TYPES as readonly string[]).includes(t);
}

router.get("/lp/library/:type", async (req, res): Promise<void> => {
  const { type } = req.params;
  if (!isValidType(type)) { res.status(400).json({ error: "Invalid type" }); return; }
  try {
    const rows = await db.execute(
      sql`SELECT id, type, name, content, is_default, sort_order, created_at, updated_at
          FROM lp_library_items
          WHERE type = ${type}
          ORDER BY sort_order ASC, id ASC`
    );
    res.json(rows.rows);
  } catch {
    res.json([]);
  }
});

router.post("/lp/library/:type", async (req, res): Promise<void> => {
  const { type } = req.params;
  if (!isValidType(type)) { res.status(400).json({ error: "Invalid type" }); return; }
  const { name, content, is_default } = req.body;
  try {
    const result = await db.execute(
      sql`INSERT INTO lp_library_items (type, name, content, is_default, sort_order)
          VALUES (${type}, ${name ?? ""}, ${JSON.stringify(content)}::jsonb, ${is_default ?? false},
                  COALESCE((SELECT MAX(sort_order) + 1 FROM lp_library_items WHERE type = ${type}), 0))
          RETURNING *`
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.put("/lp/library/:type/:id", async (req, res): Promise<void> => {
  const { type, id } = req.params;
  if (!isValidType(type)) { res.status(400).json({ error: "Invalid type" }); return; }
  const { name, content, is_default, sort_order } = req.body;
  try {
    const result = await db.execute(
      sql`UPDATE lp_library_items
          SET name = ${name ?? ""}, content = ${JSON.stringify(content)}::jsonb,
              is_default = ${is_default ?? false},
              sort_order = COALESCE(${sort_order ?? null}, sort_order),
              updated_at = now()
          WHERE id = ${Number(id)} AND type = ${type}
          RETURNING *`
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.patch("/lp/library/:type/:id/default", async (req, res): Promise<void> => {
  const { type, id } = req.params;
  if (!isValidType(type)) { res.status(400).json({ error: "Invalid type" }); return; }
  try {
    const result = await db.execute(
      sql`UPDATE lp_library_items
          SET is_default = NOT is_default, updated_at = now()
          WHERE id = ${Number(id)} AND type = ${type}
          RETURNING *`
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.delete("/lp/library/:type/:id", async (req, res): Promise<void> => {
  const { type, id } = req.params;
  if (!isValidType(type)) { res.status(400).json({ error: "Invalid type" }); return; }
  try {
    await db.execute(
      sql`DELETE FROM lp_library_items WHERE id = ${Number(id)} AND type = ${type}`
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
