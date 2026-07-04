import { getTenantId, requirePermission } from "../../middleware/requireAuth";
import { Router } from "express";
import { eq, and, or, isNull } from "drizzle-orm";
import { db } from "@workspace/db";
import { salesLayoutDefaultsTable } from "@workspace/db";
import { isDandyTenant } from "../../lib/planFeatures";
import { isDandyGatedLayoutKey } from "@workspace/one-pager-types/constants";

const router = Router();

// ─── GET /sales/layout-defaults/:key ─────────────────────────
// Fetch a single layout default by template key. Resolution order:
// tenant row → global row (tenant_id NULL, superadmin-managed) → null.
// A tenant row fully overrides the global row (whole-row precedence).
router.get("/layout-defaults/:key", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const key = String(req.params.key);
    const rows = await db
      .select()
      .from(salesLayoutDefaultsTable)
      .where(
        and(
          or(
            eq(salesLayoutDefaultsTable.tenantId, tenantId),
            isNull(salesLayoutDefaultsTable.tenantId),
          ),
          eq(salesLayoutDefaultsTable.templateKey, key),
        )
      );
    const tenantRow = rows.find((r) => r.tenantId !== null);
    if (tenantRow) {
      res.json(tenantRow.config);
      return;
    }
    const globalRow = rows.find((r) => r.tenantId === null);
    if (!globalRow) {
      res.json(null);
      return;
    }
    // Dandy-gated built-in layouts must never leak to non-Dandy tenants via
    // the global fallback (their tenant rows are already blocked at write
    // time below).
    if (isDandyGatedLayoutKey(key) && !(await isDandyTenant(tenantId))) {
      res.json(null);
      return;
    }
    res.json(globalRow.config);
  } catch (err) {
    console.error("GET /layout-defaults/:key error:", err);
    res.status(500).json({ error: "Failed to load layout default" });
  }
});

// ─── GET /sales/layout-defaults ──────────────────────────────
// List all layout defaults for the tenant, with global rows (tenant_id NULL)
// as the base layer and the tenant's own rows overriding per key.
router.get("/layout-defaults", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const rows = await db
      .select()
      .from(salesLayoutDefaultsTable)
      .where(
        or(
          eq(salesLayoutDefaultsTable.tenantId, tenantId),
          isNull(salesLayoutDefaultsTable.tenantId),
        )
      );
    // Return as key → config map for easy client consumption.
    // Global layer first; gated keys only reach Dandy tenants.
    const result: Record<string, unknown> = {};
    const globalRows = rows.filter((r) => r.tenantId === null);
    const gatedGlobal = globalRows.some((r) => isDandyGatedLayoutKey(r.templateKey));
    const dandy = gatedGlobal ? await isDandyTenant(tenantId) : false;
    for (const row of globalRows) {
      if (isDandyGatedLayoutKey(row.templateKey) && !dandy) continue;
      result[row.templateKey] = row.config;
    }
    for (const row of rows) {
      if (row.tenantId !== null) result[row.templateKey] = row.config;
    }
    res.json(result);
  } catch (err) {
    console.error("GET /layout-defaults error:", err);
    res.status(500).json({ error: "Failed to load layout defaults" });
  }
});

// ─── PUT /sales/layout-defaults/:key ─────────────────────────
// Upsert a layout default (admin only)
router.put("/layout-defaults/:key", requirePermission("sales_campaigns"), async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    // Defense in depth behind the client gate: a non-Dandy tenant must not be
    // able to author/persist layout state for the Dandy-only built-in
    // templates (comparison / agreement-summary).
    if (isDandyGatedLayoutKey(String(req.params.key)) && !(await isDandyTenant(tenantId))) {
      res.status(403).json({ error: "This template is not available for your workspace" });
      return;
    }
    const { config } = req.body;
    if (config === undefined) {
      res.status(400).json({ error: "config is required" });
      return;
    }

    // Check if row exists
    const [existing] = await db
      .select()
      .from(salesLayoutDefaultsTable)
      .where(
        and(
          eq(salesLayoutDefaultsTable.tenantId, tenantId),
          eq(salesLayoutDefaultsTable.templateKey, String(req.params.key)),
        )
      );

    if (existing) {
      const [updated] = await db
        .update(salesLayoutDefaultsTable)
        .set({ config })
        .where(eq(salesLayoutDefaultsTable.id, existing.id))
        .returning();
      res.json(updated?.config ?? config);
    } else {
      const [inserted] = await db
        .insert(salesLayoutDefaultsTable)
        .values({
          tenantId,
          templateKey: String(req.params.key),
          config,
        })
        .returning();
      res.status(201).json(inserted?.config ?? config);
    }
  } catch (err) {
    console.error("PUT /layout-defaults/:key error:", err);
    res.status(500).json({ error: "Failed to save layout default" });
  }
});

// ─── DELETE /sales/layout-defaults/:key ──────────────────────
// Delete a layout default (admin only)
router.delete("/layout-defaults/:key", requirePermission("sales_campaigns"), async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    // Defense in depth behind the client gate: reject non-Dandy deletes of the
    // Dandy-only built-in template layouts before touching the database.
    if (isDandyGatedLayoutKey(String(req.params.key)) && !(await isDandyTenant(tenantId))) {
      res.status(403).json({ error: "This template is not available for your workspace" });
      return;
    }
    await db
      .delete(salesLayoutDefaultsTable)
      .where(
        and(
          eq(salesLayoutDefaultsTable.tenantId, tenantId),
          eq(salesLayoutDefaultsTable.templateKey, String(req.params.key)),
        )
      );
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /layout-defaults/:key error:", err);
    res.status(500).json({ error: "Failed to delete layout default" });
  }
});

export default router;
