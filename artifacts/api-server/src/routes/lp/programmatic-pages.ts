// Programmatic Pages — DTR variables from real pages + bulk cloning
import { Router } from "express";
import { db } from "@workspace/db";
import { lpPagesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { getTenantId } from "../../middleware/requireAuth";
import { requirePlanFeature } from "../../middleware/requirePlanFeature";
import { userCanPublish } from "./pages";
import { loadRepDirectory, fillRepVariables } from "../../lib/sales/rep-directory";
import { triggerPublishedRender } from "../../lib/triggerPublishedRender";
import { getRequestHost } from "../../lib/requestHost";
import { isUniqueViolation } from "../../lib/dbErrors";

const router = Router();

// Plan gate (Scale+) over the whole programmatic surface — list, DTR rules,
// templates, bulk-generate, preview. Published clones themselves are ordinary
// lp_pages and keep serving to visitors regardless of plan.
router.use("/lp/programmatic", requirePlanFeature("programmaticPages"));

// ─── DTR Rules ────────────────────────────────────────────────────
// DTR rules are stored in each page's `pageVariables` jsonb field.
// This endpoint reads from real pages.

// GET /lp/programmatic/pages — list pages with their DTR variables
router.get("/lp/programmatic/pages", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res);
    if (tenantId === null) return;

    const pages = await db
      .select({
        id: lpPagesTable.id,
        title: lpPagesTable.title,
        slug: lpPagesTable.slug,
        pageVariables: lpPagesTable.pageVariables,
        status: lpPagesTable.status,
      })
      .from(lpPagesTable)
      .where(eq(lpPagesTable.tenantId, tenantId))
      .orderBy(lpPagesTable.title);

    // Enrich with variable count
    const enriched = pages.map((p) => {
      const vars = (p.pageVariables && typeof p.pageVariables === "object" && !Array.isArray(p.pageVariables))
        ? p.pageVariables as Record<string, string>
        : {};
      return {
        id: p.id,
        title: p.title,
        slug: p.slug,
        status: p.status,
        variableCount: Object.keys(vars).length,
        variables: vars,
      };
    });

    res.json(enriched);
  } catch (err) {
    console.error("GET /lp/programmatic/pages error:", err);
    res.status(500).json({ error: "Failed to load pages" });
  }
});

// GET /lp/programmatic/dtr-rules/:pageId — get DTR variables for a specific page
router.get("/lp/programmatic/dtr-rules/:pageId", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res);
    if (tenantId === null) return;

    const pageId = parseInt(String(req.params.pageId), 10);
    if (isNaN(pageId)) {
      res.status(400).json({ error: "Invalid pageId" });
      return;
    }

    const [page] = await db
      .select({ id: lpPagesTable.id, title: lpPagesTable.title, slug: lpPagesTable.slug, pageVariables: lpPagesTable.pageVariables, blocks: lpPagesTable.blocks })
      .from(lpPagesTable)
      .where(and(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.id, pageId)));

    if (!page) {
      res.status(404).json({ error: "Page not found" });
      return;
    }

    const vars = (page.pageVariables && typeof page.pageVariables === "object" && !Array.isArray(page.pageVariables))
      ? page.pageVariables as Record<string, string>
      : {};

    // Also scan blocks for {{token}} usage
    const blocksStr = JSON.stringify(page.blocks || []);
    const tokenRegex = /\{\{([^{}|]+?)(?:\|([^{}]*?))?\}\}/g;
    const tokensInBlocks = new Set<string>();
    let match;
    while ((match = tokenRegex.exec(blocksStr)) !== null) {
      tokensInBlocks.add(match[1].trim().toLowerCase());
    }

    // Build rules list combining declared variables + detected tokens
    const rules: Array<{ variable: string; defaultValue: string; source: string; inBlocks: boolean }> = [];

    // Add declared page variables. Internal keys (e.g. __linkedFormStyle,
    // persisted by the editor into the same jsonb) are NOT user variables —
    // they stay out of the rules list and are preserved separately on PUT.
    for (const [key, val] of Object.entries(vars)) {
      if (key.startsWith("__")) continue;
      rules.push({ variable: key, defaultValue: val, source: "page_variable", inBlocks: tokensInBlocks.has(key.toLowerCase()) });
      tokensInBlocks.delete(key.toLowerCase());
    }

    // Add any tokens found in blocks but not declared as variables
    for (const token of tokensInBlocks) {
      rules.push({ variable: token, defaultValue: "", source: "detected_in_blocks", inBlocks: true });
    }

    res.json({
      pageId: page.id,
      pageTitle: page.title,
      pageSlug: page.slug,
      rules,
      tokenCount: rules.length,
    });
  } catch (err) {
    console.error("GET /lp/programmatic/dtr-rules/:pageId error:", err);
    res.status(500).json({ error: "Failed to load DTR rules" });
  }
});

// PUT /lp/programmatic/dtr-rules/:pageId — update page variables
router.put("/lp/programmatic/dtr-rules/:pageId", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res);
    if (tenantId === null) return;

    const pageId = parseInt(String(req.params.pageId), 10);
    if (isNaN(pageId)) {
      res.status(400).json({ error: "Invalid pageId" });
      return;
    }

    const { variables } = req.body as { variables?: Record<string, string> };
    if (!variables || typeof variables !== "object") {
      res.status(400).json({ error: "variables must be an object" });
      return;
    }

    // The client rebuilds the variables map from the VISIBLE rules list, which
    // excludes internal `__` keys (e.g. __linkedFormStyle written by the
    // editor). Merge those back from the existing row so saving a programmatic
    // variable never silently wipes editor state stored in the same jsonb.
    const [existing] = await db
      .select({ pageVariables: lpPagesTable.pageVariables })
      .from(lpPagesTable)
      .where(and(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.id, pageId)));
    if (!existing) {
      res.status(404).json({ error: "Page not found" });
      return;
    }
    const existingVars = (existing.pageVariables && typeof existing.pageVariables === "object" && !Array.isArray(existing.pageVariables))
      ? existing.pageVariables as Record<string, string>
      : {};
    const internalVars = Object.fromEntries(
      Object.entries(existingVars).filter(([k]) => k.startsWith("__")),
    );
    const nextVars = { ...internalVars, ...variables };

    const [updated] = await db
      .update(lpPagesTable)
      .set({ pageVariables: nextVars })
      .where(and(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.id, pageId)))
      .returning({ id: lpPagesTable.id, pageVariables: lpPagesTable.pageVariables });

    if (!updated) {
      res.status(404).json({ error: "Page not found" });
      return;
    }

    res.json({ success: true, pageId: updated.id, variables: updated.pageVariables });
  } catch (err) {
    console.error("PUT /lp/programmatic/dtr-rules/:pageId error:", err);
    res.status(500).json({ error: "Failed to update DTR rules" });
  }
});

// ─── Bulk Generation ──────────────────────────────────────────────

// GET /lp/programmatic/templates — list pages marked as templates for bulk gen
router.get("/lp/programmatic/templates", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res);
    if (tenantId === null) return;

    const templates = await db
      .select({ id: lpPagesTable.id, title: lpPagesTable.title, slug: lpPagesTable.slug, templateLabel: lpPagesTable.templateLabel })
      .from(lpPagesTable)
      .where(and(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.isTemplate, true)));

    res.json(templates.map(t => ({ id: t.id, title: t.templateLabel || t.title, slug: t.slug })));
  } catch (err) {
    console.error("GET /lp/programmatic/templates error:", err);
    res.status(500).json({ error: "Failed to load templates" });
  }
});

// POST /lp/programmatic/bulk-generate — clone a template page N times with variable overrides
//
// Body: { templateId, rows: [{ slug, variables }], publish?, autoSuffix? }
//   - variables become the page's pageVariables (DTR defaults), so every
//     {{token}} in the template's blocks is filled per page.
//   - a row's `rep_email` fills rep_name / rep_first_name / rep_title /
//     rep_photo / rep_calendar / rep_phone from the Sales Reps library
//     (values already in the row win).
//   - publish: create the pages as published (only for users allowed to
//     publish; otherwise they stay drafts and `publishSkipped` says why).
//   - autoSuffix: when a slug is taken, try slug-2, slug-3, … instead of
//     failing the row.
// Each created/failed entry carries the row's `index` so the client can join
// results back to the spreadsheet (links CSV).
router.post("/lp/programmatic/bulk-generate", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res);
    if (tenantId === null) return;

    const { templateId, rows, publish, autoSuffix } = req.body as {
      templateId?: number;
      rows?: Array<{ slug: string; variables: Record<string, string> }>;
      publish?: boolean;
      autoSuffix?: boolean;
    };

    if (!templateId || !Array.isArray(rows) || rows.length === 0) {
      res.status(400).json({ error: "templateId and rows[] are required" });
      return;
    }

    if (rows.length > 500) {
      res.status(400).json({ error: "Maximum 500 pages per batch" });
      return;
    }

    // Get template
    const [template] = await db
      .select()
      .from(lpPagesTable)
      .where(and(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.id, templateId)));

    if (!template) {
      res.status(404).json({ error: "Template not found" });
      return;
    }

    const wantsPublish = publish === true;
    const canPublish = wantsPublish ? await userCanPublish(req.authUser, tenantId) : false;
    const status = wantsPublish && canPublish ? "published" : "draft";

    const needsReps = rows.some((r) => typeof r?.variables?.rep_email === "string" && r.variables.rep_email.trim());
    const repDir = needsReps ? await loadRepDirectory(tenantId) : null;
    const repUnmatched = new Set<string>();

    const created: Array<{ index: number; id: number; slug: string; status: string }> = [];
    const errors: Array<{ index: number; slug: string; error: string }> = [];

    const baseVars = (template.pageVariables && typeof template.pageVariables === "object" && !Array.isArray(template.pageVariables))
      ? template.pageVariables as Record<string, string>
      : {};

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      const rawSlug = String(row?.slug ?? "").trim().toLowerCase();
      if (!rawSlug) {
        errors.push({ index, slug: "", error: "Missing slug" });
        continue;
      }
      let rowVars: Record<string, string> = {};
      for (const [k, v] of Object.entries(row.variables ?? {})) rowVars[String(k).toLowerCase()] = String(v ?? "");
      if (repDir) {
        const filled = fillRepVariables(rowVars, repDir);
        rowVars = filled.vars;
        if (filled.matched === false) repUnmatched.add(rowVars.rep_email.trim());
      }
      // Merge template pageVariables with row-specific overrides
      const mergedVars = { ...baseVars, ...rowVars };
      const who = [rowVars.first_name, rowVars.last_name].filter(Boolean).join(" ") || rowVars.company || rawSlug;

      let done = false;
      for (let attempt = 0; attempt < (autoSuffix ? 20 : 1) && !done; attempt++) {
        const slug = attempt === 0 ? rawSlug : `${rawSlug}-${attempt + 1}`;
        try {
          const [page] = await db
            .insert(lpPagesTable)
            .values({
              tenantId,
              title: `${template.title} — ${who}`,
              slug,
              blocks: Array.isArray(template.blocks) ? template.blocks : [],
              status,
              customCss: template.customCss ?? "",
              metaTitle: template.metaTitle ?? "",
              metaDescription: template.metaDescription ?? "",
              ogImage: template.ogImage ?? "",
              animationsEnabled: template.animationsEnabled ?? true,
              smoothScroll: template.smoothScroll ?? true,
              styleOverrides: template.styleOverrides ?? null,
              pageVariables: mergedVars,
              createdBy: req.authUser?.email ?? null,
            })
            .returning({ id: lpPagesTable.id, slug: lpPagesTable.slug, status: lpPagesTable.status });
          created.push({ index, id: page.id, slug: page.slug, status: page.status });
          if (page.status === "published") {
            triggerPublishedRender({ pageId: page.id, requestHost: getRequestHost(req) });
          }
          done = true;
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          const isDupe = isUniqueViolation(err) || message.includes("23505") || message.includes("duplicate");
          if (isDupe && autoSuffix) continue;
          errors.push({ index, slug, error: isDupe ? "Slug already exists" : "Failed to create" });
          done = true;
        }
      }
      if (!done) errors.push({ index, slug: rawSlug, error: "Slug already exists" });
    }

    res.json({
      success: true,
      pagesGenerated: created.length,
      errors: errors.length,
      created,
      failed: errors,
      published: status === "published",
      publishSkipped: wantsPublish && !canPublish ? "You don't have permission to publish, so the pages were created as drafts." : null,
      repUnmatched: [...repUnmatched],
    });
  } catch (err) {
    console.error("POST /lp/programmatic/bulk-generate error:", err);
    res.status(500).json({ error: "Failed to generate pages" });
  }
});

// POST /lp/programmatic/preview — preview DTR replacement on a page's blocks
router.post("/lp/programmatic/preview", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res);
    if (tenantId === null) return;

    const { pageId, variables } = req.body as { pageId?: number; variables?: Record<string, string> };
    if (!pageId) {
      res.status(400).json({ error: "pageId required" });
      return;
    }

    const [page] = await db
      .select({ blocks: lpPagesTable.blocks, title: lpPagesTable.title })
      .from(lpPagesTable)
      .where(and(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.id, pageId)));

    if (!page) {
      res.status(404).json({ error: "Page not found" });
      return;
    }

    // Apply DTR replacements
    const params = variables || {};
    const blocksStr = JSON.stringify(page.blocks || []);
    let rendered = blocksStr;
    for (const [key, value] of Object.entries(params)) {
      const regex = new RegExp(`\\{\\{${key}(?:\\|[^{}]*)?\\}\\}`, "gi");
      rendered = rendered.replace(regex, value);
    }

    res.json({
      success: true,
      title: page.title,
      renderedBlocks: JSON.parse(rendered),
    });
  } catch (err) {
    console.error("POST /lp/programmatic/preview error:", err);
    res.status(500).json({ error: "Failed to preview" });
  }
});

export default router;
