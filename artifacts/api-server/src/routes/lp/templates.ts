// Template Marketplace supplementary routes
// Core template endpoints (GET /lp/templates, clone, mark-template) live in pages.ts
// This file adds the enriched listing endpoint for the marketplace UI.

import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { lpPagesTable } from "@workspace/db";
import { getTenantId } from "../../middleware/requireAuth";

const router = Router();

// GET /lp/templates/enriched — templates with block count for the marketplace
router.get("/lp/templates/enriched", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res);
    if (tenantId === null) return;

    const templates = await db
      .select()
      .from(lpPagesTable)
      .where(and(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.isTemplate, true)));

    const enriched = templates.map((t) => {
      const blocks = Array.isArray(t.blocks) ? t.blocks : [];
      return {
        id: t.id,
        title: t.title,
        slug: t.slug,
        templateLabel: t.templateLabel || t.title,
        templateDescription: t.templateDescription || "",
        blockCount: blocks.length,
        status: t.status,
        mode: t.mode,
        ogImage: t.ogImage || "",
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      };
    });

    res.json(enriched);
  } catch (err) {
    console.error("GET /lp/templates/enriched error:", String(err));
    res.status(500).json({ error: "Failed to load templates" });
  }
});

export default router;
