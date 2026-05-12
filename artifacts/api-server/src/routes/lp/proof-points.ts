// Task #256 — REST CRUD for the per-tenant proof-point library. Lives at
// /lp/proof-points. Strict tenant isolation: every read/write is scoped
// by the authenticated tenantId, identical to the lp_library_items routes.
import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getTenantId } from "../../middleware/requireAuth";

const router = Router();

router.get("/lp/proof-points", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    const rows = await db.execute(
      sql`SELECT id, value, label, source_url, as_of_date, approved_for_ai, sort_order, created_at, updated_at
          FROM lp_proof_points
          WHERE tenant_id = ${tenantId}
          ORDER BY sort_order ASC, id ASC`,
    );
    res.json(rows.rows);
  } catch {
    res.json([]);
  }
});

router.post("/lp/proof-points", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const { value, label, source_url, as_of_date, approved_for_ai } = req.body ?? {};
  const approved = approved_for_ai === false ? false : true;
  try {
    const result = await db.execute(
      sql`INSERT INTO lp_proof_points
            (tenant_id, value, label, source_url, as_of_date, approved_for_ai, sort_order)
          VALUES (
            ${tenantId},
            ${String(value ?? "")},
            ${String(label ?? "")},
            ${String(source_url ?? "")},
            ${as_of_date ? String(as_of_date) : null},
            ${approved},
            COALESCE((SELECT MAX(sort_order) + 1 FROM lp_proof_points WHERE tenant_id = ${tenantId}), 0)
          )
          RETURNING *`,
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.put("/lp/proof-points/:id", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const { id } = req.params;
  const { value, label, source_url, as_of_date, approved_for_ai, sort_order } = req.body ?? {};
  const approvedParam = typeof approved_for_ai === "boolean" ? approved_for_ai : null;
  try {
    const result = await db.execute(
      sql`UPDATE lp_proof_points
          SET value           = ${String(value ?? "")},
              label           = ${String(label ?? "")},
              source_url      = ${String(source_url ?? "")},
              as_of_date      = ${as_of_date ? String(as_of_date) : null},
              approved_for_ai = COALESCE(${approvedParam}, approved_for_ai),
              sort_order      = COALESCE(${sort_order ?? null}, sort_order),
              updated_at      = now()
          WHERE id = ${Number(id)} AND tenant_id = ${tenantId}
          RETURNING *`,
    );
    if (!result.rows.length) { res.status(404).json({ error: "Proof point not found" }); return; }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.delete("/lp/proof-points/:id", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const { id } = req.params;
  try {
    await db.execute(
      sql`DELETE FROM lp_proof_points WHERE id = ${Number(id)} AND tenant_id = ${tenantId}`,
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
