// Template Marketplace supplementary routes
// Core template endpoints (GET /lp/templates, clone, mark-template) live in pages.ts
// This file adds the enriched listing endpoint for the marketplace UI.

import { Router } from "express";
import { eq, and, or, isNull } from "drizzle-orm";
import { db } from "@workspace/db";
import { lpPagesTable } from "@workspace/db";
import { getTenantId } from "../../middleware/requireAuth";
import { getTenantIndustry } from "../../lib/tenantIndustry";

const router = Router();

// GET /lp/templates/enriched — templates with block count for the marketplace.
// Returns the union of:
//   1. The caller's tenant-owned templates
//   2. Global templates whose `industry` is null OR matches the caller's tenant industry
router.get("/lp/templates/enriched", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res);
    if (tenantId === null) return;
    const industry = await getTenantIndustry(tenantId);

    const templates = await db
      .select()
      .from(lpPagesTable)
      .where(
        and(
          eq(lpPagesTable.isTemplate, true),
          or(
            eq(lpPagesTable.tenantId, tenantId),
            and(
              eq(lpPagesTable.isGlobal, true),
              or(isNull(lpPagesTable.industry), eq(lpPagesTable.industry, industry)),
            ),
          ),
        ),
      );

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
        isGlobal: t.isGlobal,
        industry: t.industry,
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
