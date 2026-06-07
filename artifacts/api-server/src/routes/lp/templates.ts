// Template Marketplace supplementary routes
// Core template endpoints (GET /lp/templates, clone, mark-template) live in pages.ts
// This file adds the enriched listing endpoint for the marketplace UI.

import { Router } from "express";
import { eq, and, or } from "drizzle-orm";
import { db } from "@workspace/db";
import { lpPagesTable, lpTemplateUsageTable } from "@workspace/db";
import { getTenantId } from "../../middleware/requireAuth";
import { getRequestHost } from "../../lib/requestHost";
import { captureTemplateThumbnail } from "../../lib/captureTemplateThumbnail";
import { PREMIUM_RANK_BY_SLUG } from "../../seeds/globalTemplates";
import { isFullPageTemplate } from "@workspace/lp-template-engine";

const router = Router();

/**
 * Placeholder/scaffold template names that should never surface in the gallery
 * (task #736 cleanup). These are blank-fill stubs like "_____ One Pager" left
 * over from authoring; they have no real content worth a thumbnail. Matched on
 * the effective label (templateLabel || title): a run of 3+ underscores, or a
 * label that starts with underscores acting as a fill-in-the-blank, or empty.
 */
function isPlaceholderTemplateLabel(label: string | null | undefined): boolean {
  const l = (label ?? "").trim();
  if (!l) return true;
  if (/_{3,}/.test(l)) return true;
  if (/^_+\s/.test(l)) return true;
  return false;
}

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

    // Per-workspace "last used" timestamps (task #753). Recorded when this
    // tenant clones a template; drives the library's "Recently Used" sort.
    // Templates with no row here have never been used by this workspace and
    // get a null lastUsedAt (the UI sorts them last).
    const usageRows = await db
      .select({
        templateId: lpTemplateUsageTable.templateId,
        lastUsedAt: lpTemplateUsageTable.lastUsedAt,
      })
      .from(lpTemplateUsageTable)
      .where(eq(lpTemplateUsageTable.tenantId, tenantId));
    const lastUsedByTemplateId = new Map<number, Date>(
      usageRows.map((r) => [r.templateId, r.lastUsedAt]),
    );

    const enriched = templates
      // Drop placeholder/scaffold templates so the gallery shows no junk cards.
      .filter((t) => !isPlaceholderTemplateLabel(t.templateLabel || t.title))
      .map((t) => {
      const blocks = Array.isArray(t.blocks) ? t.blocks : [];
      // Expose the block-type list so the UI can audience-gate templates
      // (e.g. hide leadership-only templates from practice-targeted pages).
      // Unknown-shape entries are skipped rather than coerced.
      const blockTypes = blocks
        .map((b) => (b && typeof b === "object" ? (b as { type?: unknown }).type : null))
        .filter((t): t is string => typeof t === "string");
      // Marketplace ordering rank — for seeded global templates we look up the
      // value from the seed file (no DB column needed). Tenant-owned templates
      // get rank 0 so they always appear above the global library when sorted
      // by rank.
      const slug = t.slug ?? "";
      const premiumRank = t.isGlobal ? (PREMIUM_RANK_BY_SLUG[slug] ?? 200) : 0;
      return {
        id: t.id,
        title: t.title,
        slug: t.slug,
        templateLabel: t.templateLabel || t.title,
        templateDescription: t.templateDescription || "",
        blockCount: blocks.length,
        blockTypes,
        // True when this is a standalone full-page template (its first block
        // renders an entire page). Drives the marketplace "Full Page" category.
        fullPage: isFullPageTemplate(
          blocks as ReadonlyArray<{ type?: unknown }>,
        ),
        status: t.status,
        mode: t.mode,
        ogImage: t.ogImage || "",
        // Real screenshot thumbnail (task #736). null until captured; the
        // gallery prefers thumbnailUrl, then ogImage, then a gradient.
        thumbnailUrl: t.thumbnailUrl || null,
        thumbnailCapturedAt: t.thumbnailCapturedAt,
        isGlobal: t.isGlobal,
        industry: t.industry,
        premiumRank,
        // Per-workspace last-used timestamp (null = never used by this tenant).
        lastUsedAt: lastUsedByTemplateId.get(t.id) ?? null,
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

// POST /lp/templates/:id/refresh-thumbnail — force a fresh screenshot capture
// for a template the caller owns. Awaited (a few seconds) so the client can
// update the card + toast on success. Tenant-owned templates only: global
// templates are platform-shared rows whose thumbnails are managed by the
// backfill/seed flow, so we refuse cross-tenant writes here (the UI hides the
// action on global cards).
router.post("/lp/templates/:id/refresh-thumbnail", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res);
    if (tenantId === null) return;
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid template id" });
      return;
    }

    const [template] = await db
      .select({ id: lpPagesTable.id, tenantId: lpPagesTable.tenantId, isGlobal: lpPagesTable.isGlobal })
      .from(lpPagesTable)
      .where(and(eq(lpPagesTable.id, id), eq(lpPagesTable.isTemplate, true)));
    if (!template) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    if (template.isGlobal) {
      res.status(403).json({ error: "Global templates are managed by the platform" });
      return;
    }
    if (template.tenantId !== tenantId) {
      res.status(404).json({ error: "Template not found" });
      return;
    }

    const result = await captureTemplateThumbnail({
      pageId: id,
      requestHost: getRequestHost(req),
      // Clear any stored (possibly broken/grey) thumbnail on failure so the card
      // honestly falls back to the page's OG image.
      clearOnFailure: true,
    });
    if (result.outcome === "skipped") {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    if (result.outcome === "fell_back") {
      // Not an error: we couldn't get a real screenshot, so the card now shows
      // the page's OG image. Report it honestly (200, captured=false) and clear
      // the client's stored thumbnail so it re-renders to the OG image.
      res.json({
        ok: true,
        captured: false,
        thumbnailUrl: null,
        thumbnailCapturedAt: null,
      });
      return;
    }
    res.json({
      ok: true,
      captured: true,
      thumbnailUrl: result.thumbnailUrl,
      thumbnailCapturedAt: result.thumbnailCapturedAt,
    });
  } catch (err) {
    console.error("POST /lp/templates/:id/refresh-thumbnail error:", String(err));
    res.status(500).json({ error: "Failed to refresh thumbnail" });
  }
});

export default router;
