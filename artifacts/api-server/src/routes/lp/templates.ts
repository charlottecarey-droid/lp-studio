// Template Marketplace supplementary routes
// Core template endpoints (GET /lp/templates, clone, mark-template) live in pages.ts
// This file adds the enriched listing endpoint for the marketplace UI.

import { Router } from "express";
import { eq, and, or, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  lpPagesTable,
  lpTemplateUsageTable,
  lpTenantFeaturedTemplatesTable,
  micrositeTemplateOverridesTable,
} from "@workspace/db";
import { getTenantId, requirePermission } from "../../middleware/requireAuth";
import { getRequestHost } from "../../lib/requestHost";
import { captureTemplateThumbnail } from "../../lib/captureTemplateThumbnail";
import { PREMIUM_RANK_BY_SLUG } from "../../seeds/globalTemplates";
import { isFullPageTemplate, getMicrositeTemplateCompatibility } from "@workspace/lp-template-engine";

const router = Router();

// Lightweight SQL projections so the template LIST endpoints never ship the
// full (often multi-MB) blocks JSONB just to derive a count + type list. The
// gallery + Template settings screen only need how MANY blocks a template has,
// the list of block TYPES, and (from the first type) whether it's a full-page
// template — none of which require the block props. Computing these in SQL
// keeps each row's payload tiny.
//   - blockCountSql: total array length (0 for a non-array/legacy value).
//   - blockTypesSql: one entry PER block — its `type` as text (null when a
//     block has no type) — with array ORDER preserved so blocks[0] stays
//     blocks[0] for isFullPageTemplate.
const blockCountSql = sql<number>`CASE WHEN jsonb_typeof(${lpPagesTable.blocks}) = 'array' THEN jsonb_array_length(${lpPagesTable.blocks}) ELSE 0 END`;
const blockTypesSql = sql<
  Array<string | null>
>`CASE WHEN jsonb_typeof(${lpPagesTable.blocks}) = 'array' THEN COALESCE((SELECT jsonb_agg(elem->>'type' ORDER BY ord) FROM jsonb_array_elements(${lpPagesTable.blocks}) WITH ORDINALITY AS arr(elem, ord)), '[]'::jsonb) ELSE '[]'::jsonb END`;

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

/**
 * Whether a GLOBAL template is one of the curated flagship / business-case
 * documents the create-microsite dropdown surfaces under `salesMode` (see
 * GET /lp/templates in pages.ts). These are the only global rows a tenant is
 * allowed to control (toggle / rename) from the Templates settings screen —
 * the full off-brand global starter library stays out of the dropdown and out
 * of marketing's control. Mirrors the `isBusinessCaseGlobal` / `isFlagshipGlobal`
 * predicates in pages.ts: is_all_in_one flagships OR a first-block business-case.
 */
function isSalesModeGlobalTemplate(t: {
  isGlobal: boolean;
  isAllInOne: boolean;
  blocks: unknown;
}): boolean {
  if (!t.isGlobal) return false;
  if (t.isAllInOne) return true;
  const blocks = Array.isArray(t.blocks) ? t.blocks : [];
  const first = blocks[0];
  const type =
    first && typeof first === "object" ? (first as { type?: unknown }).type : "";
  return typeof type === "string" && type.startsWith("business-case");
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
      .select({
        id: lpPagesTable.id,
        title: lpPagesTable.title,
        slug: lpPagesTable.slug,
        templateLabel: lpPagesTable.templateLabel,
        templateDescription: lpPagesTable.templateDescription,
        status: lpPagesTable.status,
        mode: lpPagesTable.mode,
        ogImage: lpPagesTable.ogImage,
        thumbnailUrl: lpPagesTable.thumbnailUrl,
        thumbnailCapturedAt: lpPagesTable.thumbnailCapturedAt,
        isGlobal: lpPagesTable.isGlobal,
        industry: lpPagesTable.industry,
        createdAt: lpPagesTable.createdAt,
        updatedAt: lpPagesTable.updatedAt,
        // Count + type list derived in SQL (see blockCountSql/blockTypesSql) so
        // the heavy block props never travel to the gallery.
        blockCount: blockCountSql,
        blockTypesRaw: blockTypesSql,
      })
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

    // Per-workspace "featured" templates (star toggle). A featured template is
    // surfaced in the marketplace "Featured" group and offered as a starting
    // point in the create-page modal. Templates with no row here are simply not
    // featured by this workspace.
    const featuredRows = await db
      .select({ templateId: lpTenantFeaturedTemplatesTable.templateId })
      .from(lpTenantFeaturedTemplatesTable)
      .where(eq(lpTenantFeaturedTemplatesTable.tenantId, tenantId));
    const featuredTemplateIds = new Set<number>(
      featuredRows.map((r) => r.templateId),
    );

    const enriched = templates
      // Drop placeholder/scaffold templates so the gallery shows no junk cards.
      .filter((t) => !isPlaceholderTemplateLabel(t.templateLabel || t.title))
      .map((t) => {
      // Block types come pre-projected from SQL (one entry per block, its
      // `type` as text or null) so the full blocks JSONB never left Postgres.
      const rawTypes = Array.isArray(t.blockTypesRaw) ? t.blockTypesRaw : [];
      // Position-preserving, type-only view for the helpers below.
      const blocksForType = rawTypes.map((type) => ({
        type: typeof type === "string" ? type : undefined,
      }));
      // Expose the block-type list so the UI can audience-gate templates
      // (e.g. hide leadership-only templates from practice-targeted pages).
      // Unknown-shape entries are skipped rather than coerced.
      const blockTypes = rawTypes.filter((t): t is string => typeof t === "string");
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
        blockCount: Number(t.blockCount) || 0,
        blockTypes,
        // True when this is a standalone full-page template (its first block
        // renders an entire page). Drives the marketplace "Full Page" category.
        fullPage: isFullPageTemplate(blocksForType),
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
        // Per-workspace "featured" flag (star toggle). true when this tenant
        // has starred the template.
        featured: featuredTemplateIds.has(t.id),
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

// PUT /lp/templates/:id/featured — toggle whether a template is "featured" for
// the caller's workspace. Featured templates appear in the marketplace
// "Featured" group and as starting points in the create-page modal. This is
// per-tenant curation: a tenant may feature any template it can see (its own,
// or any global template). Body: { featured: boolean }. Idempotent — starring
// an already-featured template is a no-op insert; un-starring a row that isn't
// there is a no-op delete.
router.put("/lp/templates/:id/featured", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res);
    if (tenantId === null) return;

    const templateId = Number(req.params.id);
    if (!Number.isInteger(templateId) || templateId <= 0) {
      res.status(400).json({ error: "Invalid template id" });
      return;
    }

    const featured = (req.body as { featured?: unknown })?.featured;
    if (typeof featured !== "boolean") {
      res.status(400).json({ error: "Body must include a boolean `featured`" });
      return;
    }

    // The template must be visible to this tenant to be featured: either the
    // tenant owns it, or it is a global template. Anything else 404s so a tenant
    // can never feature (and thereby probe the existence of) another
    // workspace's private template.
    const [template] = await db
      .select({ id: lpPagesTable.id })
      .from(lpPagesTable)
      .where(
        and(
          eq(lpPagesTable.id, templateId),
          eq(lpPagesTable.isTemplate, true),
          or(
            eq(lpPagesTable.tenantId, tenantId),
            eq(lpPagesTable.isGlobal, true),
          ),
        ),
      )
      .limit(1);
    if (!template) {
      res.status(404).json({ error: "Template not found" });
      return;
    }

    if (featured) {
      // Idempotent insert — the unique (tenant_id, template_id) index makes a
      // repeat star a no-op.
      await db
        .insert(lpTenantFeaturedTemplatesTable)
        .values({ tenantId, templateId })
        .onConflictDoNothing();
    } else {
      await db
        .delete(lpTenantFeaturedTemplatesTable)
        .where(
          and(
            eq(lpTenantFeaturedTemplatesTable.tenantId, tenantId),
            eq(lpTenantFeaturedTemplatesTable.templateId, templateId),
          ),
        );
    }

    res.json({ featured });
  } catch (err) {
    console.error("PUT /lp/templates/:id/featured error:", String(err));
    res.status(500).json({ error: "Failed to update featured state" });
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

// GET /lp/templates/manage — admin-only listing for the Template settings
// screen (task #1219). Returns the caller's tenant-owned templates PLUS the
// curated built-in (global) flagship / business-case templates the dropdown
// surfaces, each with their create-microsite compatibility, the raw override
// flag, and the resulting effective state. Built-in rows carry isGlobal=true and
// have their per-tenant enable/rename applied from lp_microsite_template_overrides.
// Gated on the "settings" permission; the server re-checks here even though the
// client hides the tab.
router.get("/lp/templates/manage", requirePermission("settings"), async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res);
    if (tenantId === null) return;

    // Two buckets, mirroring the create-microsite dropdown's `salesMode` set:
    //   1. The tenant's OWN templates — controlled directly via the lp_pages row.
    //   2. The curated GLOBAL flagship / business-case templates that flood the
    //      dropdown — controlled per-tenant via lp_microsite_template_overrides
    //      so the shared row is never mutated and edits never leak across tenants.
    const [owned, globals, overrideRows] = await Promise.all([
      db
        .select({
          id: lpPagesTable.id,
          title: lpPagesTable.title,
          templateLabel: lpPagesTable.templateLabel,
          templateDescription: lpPagesTable.templateDescription,
          micrositeEnabled: lpPagesTable.micrositeEnabled,
          funnelStage: lpPagesTable.funnelStage,
          eligibleSegments: lpPagesTable.eligibleSegments,
          eligiblePersonas: lpPagesTable.eligiblePersonas,
          eligibleFunnelStages: lpPagesTable.eligibleFunnelStages,
          updatedAt: lpPagesTable.updatedAt,
          blockCount: blockCountSql,
          blockTypesRaw: blockTypesSql,
        })
        .from(lpPagesTable)
        .where(
          and(
            eq(lpPagesTable.isTemplate, true),
            eq(lpPagesTable.tenantId, tenantId),
            eq(lpPagesTable.isGlobal, false),
          ),
        ),
      db
        .select({
          id: lpPagesTable.id,
          title: lpPagesTable.title,
          templateLabel: lpPagesTable.templateLabel,
          templateDescription: lpPagesTable.templateDescription,
          funnelStage: lpPagesTable.funnelStage,
          updatedAt: lpPagesTable.updatedAt,
          blockCount: blockCountSql,
          blockTypesRaw: blockTypesSql,
        })
        .from(lpPagesTable)
        .where(
          and(
            eq(lpPagesTable.isTemplate, true),
            eq(lpPagesTable.isGlobal, true),
            or(
              eq(lpPagesTable.isAllInOne, true),
              sql`(${lpPagesTable.blocks} -> 0 ->> 'type') LIKE 'business-case%'`,
            ),
          ),
        ),
      db
        .select()
        .from(micrositeTemplateOverridesTable)
        .where(eq(micrositeTemplateOverridesTable.tenantId, tenantId)),
    ]);

    const overrideByTemplateId = new Map(
      overrideRows.map((o) => [o.templateId, o]),
    );

    const ownedOut = owned
      .filter((t) => !isPlaceholderTemplateLabel(t.templateLabel || t.title))
      .map((t) => {
        const blocksForType = (Array.isArray(t.blockTypesRaw) ? t.blockTypesRaw : []).map(
          (type) => ({ type: typeof type === "string" ? type : undefined }),
        );
        const { compatible, reason } = getMicrositeTemplateCompatibility(blocksForType);
        const effectiveEnabled =
          typeof t.micrositeEnabled === "boolean" ? t.micrositeEnabled : compatible;
        return {
          id: t.id,
          // Owned templates can carry per-tenant eligibility + are renamed in place.
          isGlobal: false,
          templateLabel: t.templateLabel || t.title,
          templateDescription: t.templateDescription || "",
          blockCount: Number(t.blockCount) || 0,
          // Computed compatibility (the auto default).
          compatible,
          compatibilityReason: reason,
          // Raw admin override: true/false = explicit, null = auto.
          micrositeEnabled: t.micrositeEnabled ?? null,
          // What the create-microsite dropdown actually uses.
          effectiveEnabled,
          // Template eligibility (June 2026) — where this template is allowed to
          // be AUTO-recommended. Empty/null on an axis = ANY (wildcard). Surfaced
          // here so the Templates settings screen can render + edit them; written
          // back via PUT /lp/pages/:id (which accepts these fields).
          funnelStage: t.funnelStage ?? null,
          eligibleSegments: Array.isArray(t.eligibleSegments)
            ? (t.eligibleSegments as unknown[]).filter((x): x is string => typeof x === "string")
            : [],
          eligiblePersonas: Array.isArray(t.eligiblePersonas)
            ? (t.eligiblePersonas as unknown[]).filter((x): x is string => typeof x === "string")
            : [],
          eligibleFunnelStages: Array.isArray(t.eligibleFunnelStages)
            ? (t.eligibleFunnelStages as unknown[]).filter((x): x is string => typeof x === "string")
            : [],
          updatedAt: t.updatedAt,
        };
      })
      .sort((a, b) => a.templateLabel.localeCompare(b.templateLabel));

    const globalOut = globals
      .filter((t) => !isPlaceholderTemplateLabel(t.templateLabel || t.title))
      .map((t) => {
        const blocksForType = (Array.isArray(t.blockTypesRaw) ? t.blockTypesRaw : []).map(
          (type) => ({ type: typeof type === "string" ? type : undefined }),
        );
        const { compatible, reason } = getMicrositeTemplateCompatibility(blocksForType);
        const ov = overrideByTemplateId.get(t.id);
        const rawEnabled = typeof ov?.enabled === "boolean" ? ov.enabled : null;
        const effectiveEnabled = rawEnabled ?? compatible;
        return {
          id: t.id,
          // Built-in (shared) template — toggled + renamed per-tenant via the
          // override table. Eligibility is platform-managed, so the UI hides the
          // per-tenant eligibility editor for these rows.
          isGlobal: true,
          templateLabel: ov?.label || t.templateLabel || t.title,
          templateDescription: t.templateDescription || "",
          blockCount: Number(t.blockCount) || 0,
          compatible,
          compatibilityReason: reason,
          micrositeEnabled: rawEnabled,
          effectiveEnabled,
          funnelStage: t.funnelStage ?? null,
          eligibleSegments: [],
          eligiblePersonas: [],
          eligibleFunnelStages: [],
          updatedAt: ov?.updatedAt ?? t.updatedAt,
        };
      })
      .sort((a, b) => a.templateLabel.localeCompare(b.templateLabel));

    // Owned templates first (a tenant's own work), then the built-in library.
    res.json([...ownedOut, ...globalOut]);
  } catch (err) {
    console.error("GET /lp/templates/manage error:", String(err));
    res.status(500).json({ error: "Failed to load templates" });
  }
});

// PATCH /lp/templates/:id/microsite-enabled — admin-only override of whether a
// tenant-owned template appears in the create-microsite dropdown (task #1219).
// body { enabled: boolean }. Tenant-scoped; refuses global templates and
// cross-tenant rows. Gated on the "settings" permission.
router.patch(
  "/lp/templates/:id/microsite-enabled",
  requirePermission("settings"),
  async (req, res): Promise<void> => {
    try {
      const tenantId = getTenantId(req, res);
      if (tenantId === null) return;
      const id = parseInt(String(req.params.id), 10);
      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid template id" });
        return;
      }
      const { enabled } = req.body as { enabled?: unknown };
      if (typeof enabled !== "boolean") {
        res.status(400).json({ error: "enabled must be a boolean" });
        return;
      }

      const [existing] = await db
        .select({
          id: lpPagesTable.id,
          tenantId: lpPagesTable.tenantId,
          isGlobal: lpPagesTable.isGlobal,
          isAllInOne: lpPagesTable.isAllInOne,
          blocks: lpPagesTable.blocks,
        })
        .from(lpPagesTable)
        .where(and(eq(lpPagesTable.id, id), eq(lpPagesTable.isTemplate, true)));
      if (!existing) {
        res.status(404).json({ error: "Template not found" });
        return;
      }

      if (existing.isGlobal) {
        // Built-in (shared) template: never mutate the shared row. Only the
        // curated flagship / business-case set is controllable; everything else
        // is invisible to the dropdown anyway.
        if (!isSalesModeGlobalTemplate(existing)) {
          res.status(404).json({ error: "Template not found" });
          return;
        }
        await db
          .insert(micrositeTemplateOverridesTable)
          .values({ tenantId, templateId: id, enabled })
          .onConflictDoUpdate({
            target: [
              micrositeTemplateOverridesTable.tenantId,
              micrositeTemplateOverridesTable.templateId,
            ],
            set: { enabled, updatedAt: new Date() },
          });
        res.json({ ok: true, micrositeEnabled: enabled });
        return;
      }

      if (existing.tenantId !== tenantId) {
        res.status(404).json({ error: "Template not found" });
        return;
      }

      await db
        .update(lpPagesTable)
        .set({ micrositeEnabled: enabled })
        .where(eq(lpPagesTable.id, id));

      res.json({ ok: true, micrositeEnabled: enabled });
    } catch (err) {
      console.error("PATCH /lp/templates/:id/microsite-enabled error:", String(err));
      res.status(500).json({ error: "Failed to update template" });
    }
  },
);

// PATCH /lp/templates/:id/microsite-label — admin-only rename of the name reps
// see for this template in the create-microsite dropdown. body { label: string }.
// An empty/blank label resets to the template's default name. For tenant-owned
// templates the label is stored on the lp_pages row (templateLabel). For built-in
// (shared) global templates the rename is stored per-tenant in
// lp_microsite_template_overrides so the shared row — and other tenants — are
// never affected. Gated on the "settings" permission.
router.patch(
  "/lp/templates/:id/microsite-label",
  requirePermission("settings"),
  async (req, res): Promise<void> => {
    try {
      const tenantId = getTenantId(req, res);
      if (tenantId === null) return;
      const id = parseInt(String(req.params.id), 10);
      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid template id" });
        return;
      }
      const { label } = req.body as { label?: unknown };
      if (typeof label !== "string") {
        res.status(400).json({ error: "label must be a string" });
        return;
      }
      const trimmed = label.trim();
      // Blank = reset to the template's default name (null inherits title).
      const nextLabel = trimmed.length > 0 ? trimmed : null;

      const [existing] = await db
        .select({
          id: lpPagesTable.id,
          tenantId: lpPagesTable.tenantId,
          isGlobal: lpPagesTable.isGlobal,
          isAllInOne: lpPagesTable.isAllInOne,
          title: lpPagesTable.title,
          templateLabel: lpPagesTable.templateLabel,
          blocks: lpPagesTable.blocks,
        })
        .from(lpPagesTable)
        .where(and(eq(lpPagesTable.id, id), eq(lpPagesTable.isTemplate, true)));
      if (!existing) {
        res.status(404).json({ error: "Template not found" });
        return;
      }

      if (existing.isGlobal) {
        if (!isSalesModeGlobalTemplate(existing)) {
          res.status(404).json({ error: "Template not found" });
          return;
        }
        await db
          .insert(micrositeTemplateOverridesTable)
          .values({ tenantId, templateId: id, label: nextLabel })
          .onConflictDoUpdate({
            target: [
              micrositeTemplateOverridesTable.tenantId,
              micrositeTemplateOverridesTable.templateId,
            ],
            set: { label: nextLabel, updatedAt: new Date() },
          });
        res.json({
          ok: true,
          templateLabel: nextLabel || existing.templateLabel || existing.title,
        });
        return;
      }

      if (existing.tenantId !== tenantId) {
        res.status(404).json({ error: "Template not found" });
        return;
      }

      await db
        .update(lpPagesTable)
        .set({ templateLabel: nextLabel })
        .where(eq(lpPagesTable.id, id));

      res.json({ ok: true, templateLabel: nextLabel || existing.title });
    } catch (err) {
      console.error("PATCH /lp/templates/:id/microsite-label error:", String(err));
      res.status(500).json({ error: "Failed to update template" });
    }
  },
);

export default router;
