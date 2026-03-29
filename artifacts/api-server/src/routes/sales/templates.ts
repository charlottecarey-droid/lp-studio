import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import { salesEmailTemplatesTable } from "@workspace/db";

const router = Router();

// List all templates
router.get("/templates", async (_req, res): Promise<void> => {
  try {
    const templates = await db
      .select()
      .from(salesEmailTemplatesTable)
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
    const [template] = await db
      .select()
      .from(salesEmailTemplatesTable)
      .where(eq(salesEmailTemplatesTable.id, Number(req.params.id)));
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
  const { name, subject, bodyHtml, bodyText, mergeVars, category } = req.body;
  if (!name || !subject) {
    res.status(400).json({ error: "name and subject are required" });
    return;
  }
  try {
    const [template] = await db
      .insert(salesEmailTemplatesTable)
      .values({
        name,
        subject,
        bodyHtml: bodyHtml ?? "",
        bodyText: bodyText ?? null,
        mergeVars: mergeVars ?? [],
        category: category ?? "general",
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
    const updates: Record<string, unknown> = {};
    const fields = ["name", "subject", "bodyHtml", "bodyText", "mergeVars", "category", "isActive"];
    for (const f of fields) {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    }

    const [updated] = await db
      .update(salesEmailTemplatesTable)
      .set(updates)
      .where(eq(salesEmailTemplatesTable.id, Number(req.params.id)))
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
    const [deleted] = await db
      .delete(salesEmailTemplatesTable)
      .where(eq(salesEmailTemplatesTable.id, Number(req.params.id)))
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
