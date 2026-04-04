import { getTenantId } from "../../middleware/requireAuth";
import { Router } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { salesEmailTemplatesTable } from "@workspace/db";

const router = Router();

// List all templates
router.get("/templates", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const templates = await db
      .select()
      .from(salesEmailTemplatesTable)
      .where(eq(salesEmailTemplatesTable.tenantId, tenantId))
      .orderBy(desc(salesEmailTemplatesTable.updatedAt));
    res.json(templates);
  } catch (err) {
    console.error("GET /sales/templates error:", err);
    res.status(500).json({ error: "Failed to load templates" });
  }
});

// Get single template
router.get("/templates/:id", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const [template] = await db
      .select()
      .from(salesEmailTemplatesTable)
      .where(and(eq(salesEmailTemplatesTable.tenantId, tenantId), eq(salesEmailTemplatesTable.id, Number(req.params.id))));
    if (!template) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    res.json(template);
  } catch (err) {
    console.error("GET /sales/templates/:id error:", err);
    res.status(500).json({ error: "Failed to load template" });
  }
});

// Create template
router.post("/templates", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const { name, subject, bodyHtml, bodyText, mergeVars, category, format } = req.body;
  if (!name || !subject) {
    res.status(400).json({ error: "name and subject are required" });
    return;
  }
  try {
    const [template] = await db
      .insert(salesEmailTemplatesTable)
      .values({
        tenantId,
        name,
        subject,
        bodyHtml: bodyHtml ?? "",
        bodyText: bodyText ?? null,
        mergeVars: mergeVars ?? [],
        category: category ?? "general",
        format: format ?? "plain",
      })
      .returning();
    res.status(201).json(template);
  } catch (err) {
    console.error("POST /sales/templates error:", err);
    res.status(500).json({ error: "Failed to create template" });
  }
});

// Update template
router.patch("/templates/:id", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const updates: Record<string, unknown> = {};
    const fields = ["name", "subject", "bodyHtml", "bodyText", "mergeVars", "category", "format", "isActive"];
    for (const f of fields) {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    }

    const [updated] = await db
      .update(salesEmailTemplatesTable)
      .set(updates)
      .where(and(eq(salesEmailTemplatesTable.tenantId, tenantId), eq(salesEmailTemplatesTable.id, Number(req.params.id))))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    console.error("PATCH /sales/templates/:id error:", err);
    res.status(500).json({ error: "Failed to update template" });
  }
});

// Delete template
router.delete("/templates/:id", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const [deleted] = await db
      .delete(salesEmailTemplatesTable)
      .where(and(eq(salesEmailTemplatesTable.tenantId, tenantId), eq(salesEmailTemplatesTable.id, Number(req.params.id))))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /sales/templates/:id error:", err);
    res.status(500).json({ error: "Failed to delete template" });
  }
});

export default router;
