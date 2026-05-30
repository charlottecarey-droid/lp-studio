import { getTenantId, requirePermission } from "../../middleware/requireAuth";
import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { salesLayoutDefaultsTable } from "@workspace/db";
import { isDandyTenant } from "../../lib/planFeatures";
import { isDandyGatedLayoutKey } from "@workspace/one-pager-types/constants";

const router = Router();

// ─── GET /sales/layout-defaults/:key ─────────────────────────
// Fetch a single layout default by template key
router.get("/layout-defaults/:key", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const [row] = await db
      .select()
      .from(salesLayoutDefaultsTable)
      .where(
        and(
          eq(salesLayoutDefaultsTable.tenantId, tenantId),
          eq(salesLayoutDefaultsTable.templateKey, String(req.params.key)),
        )
      );
    if (!row) {
      res.json(null);
      return;
    }
    res.json(row.config);
  } catch (err) {
    console.error("GET /layout-defaults/:key error:", err);
    res.status(500).json({ error: "Failed to load layout default" });
  }
});

// ─── GET /sales/layout-defaults ──────────────────────────────
// List all layout defaults for the tenant
router.get("/layout-defaults", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const rows = await db
      .select()
      .from(salesLayoutDefaultsTable)
      .where(eq(salesLayoutDefaultsTable.tenantId, tenantId));
    // Return as key → config map for easy client consumption
    const result: Record<string, unknown> = {};
    for (const row of rows) {
      result[row.templateKey] = row.config;
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
