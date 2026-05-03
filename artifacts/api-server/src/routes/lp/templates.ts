// Template Marketplace supplementary routes
// Core template endpoints (GET /lp/templates, clone, mark-template) live in pages.ts
// This file adds the enriched listing endpoint for the marketplace UI.

import { Router } from "express";
import { eq, and, or } from "drizzle-orm";
import { db } from "@workspace/db";
import { lpPagesTable } from "@workspace/db";
import { getTenantId } from "../../middleware/requireAuth";

const router = Router();

// GET /lp/templates/enriched — templates with block count for the marketplace.
// Returns the union of:
//   1. The caller's tenant-owned templates
//   2. All global templates (is_global=true), regardless of industry — every
//      tenant has access to the full global template library. The UI lists
//      tenant-owned templates first, then global starters.
router.get("/lp/templates/enriched", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res);
    if (tenantId === null) return;

    const templates = await db
      .select()
      .from(lpPagesTable)
      .where(
        and(
          eq(lpPagesTable.isTemplate, true),
          or(
            eq(lpPagesTable.tenantId, tenantId),
            eq(lpPagesTable.isGlobal, true),
          ),
        ),
      );

    const enriched = templates.map((t) => {
      const blocks = Array.isArray(t.blocks) ? t.blocks : [];
      // Expose the block-type list so the UI can audience-gate templates
      // (e.g. hide leadership-only templates from practice-targeted pages).
      // Unknown-shape entries are skipped rather than coerced.
      const blockTypes = blocks
        .map((b) => (b && typeof b === "object" ? (b as { type?: unknown }).type : null))
        .filter((t): t is string => typeof t === "string");
      return {
        id: t.id,
        title: t.title,
        slug: t.slug,
        templateLabel: t.templateLabel || t.title,
        templateDescription: t.templateDescription || "",
        blockCount: blocks.length,
        blockTypes,
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

// GET /lp/templates/:id/preview — full block JSON for a single template the
// caller is allowed to see (their own, or any global template).
// Used by the marketplace preview modal so users can scroll through a rendered
// template before cloning it. Read-only: never returns drafts the caller does
// not own and never returns non-template pages.
router.get("/lp/templates/:id/preview", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res);
    if (tenantId === null) return;
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid template id" });
      return;
    }
    const [template] = await db
      .select()
      .from(lpPagesTable)
      .where(
        and(
          eq(lpPagesTable.id, id),
          eq(lpPagesTable.isTemplate, true),
          or(
            eq(lpPagesTable.tenantId, tenantId),
            eq(lpPagesTable.isGlobal, true),
          ),
        ),
      );
    if (!template) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    res.json({
      id: template.id,
      title: template.title,
      templateLabel: template.templateLabel || template.title,
      templateDescription: template.templateDescription || "",
      blocks: Array.isArray(template.blocks) ? template.blocks : [],
    });
  } catch (err) {
    console.error("GET /lp/templates/:id/preview error:", String(err));
    res.status(500).json({ error: "Failed to load template preview" });
  }
});

export default router;
