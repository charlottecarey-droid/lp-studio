/**
 * Page version history routes (migration 0175, lib/pageVersions.ts).
 *
 *   GET  /lp/pages/deleted                       deleted pages that can be brought back
 *   GET  /lp/pages/:pageId/versions              a page's history, newest first
 *   POST /lp/pages/:pageId/checkpoint            snapshot the page now, with a note
 *   GET  /lp/page-versions/:versionId            one version, with its full content
 *   POST /lp/page-versions/:versionId/restore    put that version's content back
 *
 * Mounted BEFORE pagesRouter so /lp/pages/deleted isn't taken for a page id.
 */
import { Router } from "express";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db, lpPagesTable, lpPageVersionsTable } from "@workspace/db";
import { getTenantId } from "../../middleware/requireAuth";
import { triggerPublishedRender } from "../../lib/triggerPublishedRender";
import { getRequestHost } from "../../lib/requestHost";
import { isUniqueViolation } from "../../lib/dbErrors";
import { cleanNote, loadPage, recordPageVersion, versionSummary, type PageSnapshot } from "../../lib/pageVersions";
import { findGridPieceInTree, userCanManageBlocks } from "./pages";

const router = Router();

const intParam = (v: unknown): number | null => {
  const n = Number.parseInt(String(v), 10);
  return Number.isInteger(n) && n > 0 ? n : null;
};

router.get("/lp/pages/deleted", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const days = Math.min(365, intParam(req.query.days) ?? 90);
  const rows = await db
    .select()
    .from(lpPageVersionsTable)
    .where(and(
      eq(lpPageVersionsTable.tenantId, tenantId),
      eq(lpPageVersionsTable.reason, "delete"),
      sql`${lpPageVersionsTable.createdAt} > now() - make_interval(days => ${days})`,
      sql`NOT EXISTS (SELECT 1 FROM lp_pages p WHERE p.id = ${lpPageVersionsTable.pageId})`,
    ))
    .orderBy(desc(lpPageVersionsTable.createdAt))
    .limit(200);
  res.json({
    days,
    pages: rows.map((v) => ({ ...versionSummary(v), deletedAt: v.createdAt, deletedBy: v.createdBy, versionId: v.id })),
  });
});

router.get("/lp/pages/:pageId/versions", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const pageId = intParam(req.params.pageId);
  if (!pageId) { res.status(400).json({ error: "Invalid page ID" }); return; }
  const limit = Math.min(200, intParam(req.query.limit) ?? 50);
  const page = await loadPage(tenantId, pageId);
  const rows = await db
    .select()
    .from(lpPageVersionsTable)
    .where(and(eq(lpPageVersionsTable.tenantId, tenantId), eq(lpPageVersionsTable.pageId, pageId)))
    .orderBy(desc(lpPageVersionsTable.createdAt), desc(lpPageVersionsTable.id))
    .limit(limit);
  if (!page && rows.length === 0) { res.status(404).json({ error: "Page not found" }); return; }
  res.json({
    page: page ? { id: page.id, title: page.title, slug: page.slug, status: page.status, updatedAt: page.updatedAt, updatedBy: page.updatedBy } : null,
    deleted: !page,
    versions: rows.map(versionSummary),
  });
});

router.post("/lp/pages/:pageId/checkpoint", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const pageId = intParam(req.params.pageId);
  if (!pageId) { res.status(400).json({ error: "Invalid page ID" }); return; }
  const page = await loadPage(tenantId, pageId);
  if (!page) { res.status(404).json({ error: "Page not found" }); return; }
  const id = await recordPageVersion(page, { reason: "checkpoint", note: cleanNote(req.body?.note) ?? "Checkpoint", by: req.authUser?.email ?? null });
  if (!id) { res.status(500).json({ error: "Couldn't save a checkpoint. Try again." }); return; }
  res.status(201).json({ versionId: id, pageId });
});

router.get("/lp/page-versions/:versionId", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const versionId = intParam(req.params.versionId);
  if (!versionId) { res.status(400).json({ error: "Invalid version ID" }); return; }
  const [v] = await db
    .select()
    .from(lpPageVersionsTable)
    .where(and(eq(lpPageVersionsTable.tenantId, tenantId), eq(lpPageVersionsTable.id, versionId)));
  if (!v) { res.status(404).json({ error: "Version not found" }); return; }
  res.json({ ...versionSummary(v), snapshot: v.snapshot });
});

/** Snapshot fields a restore writes back onto an existing page. Slug stays put so live links keep working. */
const RESTORE_FIELDS = [
  "title", "blocks", "customCss", "metaTitle", "metaDescription", "ogImage", "pageVariables", "ctaDefault",
  "styleOverrides", "animationsEnabled", "smoothScroll", "showCookieBanner", "audienceType", "segmentId",
  "accountId", "allowIndexing", "allowFollowing",
] as const;

router.post("/lp/page-versions/:versionId/restore", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const versionId = intParam(req.params.versionId);
  if (!versionId) { res.status(400).json({ error: "Invalid version ID" }); return; }
  const [v] = await db
    .select()
    .from(lpPageVersionsTable)
    .where(and(eq(lpPageVersionsTable.tenantId, tenantId), eq(lpPageVersionsTable.id, versionId)));
  if (!v) { res.status(404).json({ error: "Version not found" }); return; }
  const snap = (v.snapshot ?? {}) as PageSnapshot;
  const by = req.authUser?.email ?? null;

  const offending = findGridPieceInTree(snap.blocks);
  if (offending && !(await userCanManageBlocks(req.authUser))) {
    res.status(403).json({ error: `Block type "${offending}" requires the blocks permission.` });
    return;
  }

  const fields: Record<string, unknown> = {};
  for (const k of RESTORE_FIELDS) if (snap[k] !== undefined) fields[k] = snap[k];
  if (!Array.isArray(fields.blocks)) fields.blocks = [];

  const current = await loadPage(tenantId, v.pageId);
  if (current) {
    await recordPageVersion(current, { reason: "restore", note: cleanNote(req.body?.note) ?? `Before restoring version ${v.id}`, by });
    const [saved] = await db
      .update(lpPagesTable)
      .set({ ...fields, updatedBy: by, ogCardImage: null, ogCardVersion: null })
      .where(and(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.id, current.id)))
      .returning({ id: lpPagesTable.id, title: lpPagesTable.title, slug: lpPagesTable.slug, status: lpPagesTable.status });
    if (saved?.status === "published") triggerPublishedRender({ pageId: saved.id, requestHost: getRequestHost(req) });
    res.json({ restored: true, recreated: false, versionId: v.id, page: saved });
    return;
  }

  // The page was deleted: bring it back as a draft, on its old slug if free.
  const baseSlug = (typeof snap.slug === "string" && snap.slug) || v.slug || `restored-page-${v.pageId}`;
  let slug = baseSlug;
  for (let n = 2; n < 50; n++) {
    const [taken] = await db.select({ id: lpPagesTable.id }).from(lpPagesTable).where(and(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.slug, slug)));
    if (!taken) break;
    slug = `${baseSlug}-restored${n > 2 ? `-${n - 1}` : ""}`;
  }
  try {
    const [page] = await db
      .insert(lpPagesTable)
      .values({
        ...(fields as Record<string, never>),
        tenantId,
        title: (typeof snap.title === "string" && snap.title) || v.title || "Restored page",
        slug,
        status: "draft",
        createdBy: by,
        updatedBy: by,
      })
      .returning({ id: lpPagesTable.id, title: lpPagesTable.title, slug: lpPagesTable.slug, status: lpPagesTable.status });
    // History follows the page to its new id.
    await db
      .update(lpPageVersionsTable)
      .set({ pageId: page.id })
      .where(and(eq(lpPageVersionsTable.tenantId, tenantId), inArray(lpPageVersionsTable.pageId, [v.pageId])));
    res.status(201).json({ restored: true, recreated: true, previousPageId: v.pageId, versionId: v.id, page, note: "The page was deleted, so it was brought back as a draft with a new page id." });
  } catch (err) {
    if (isUniqueViolation(err)) { res.status(409).json({ error: "A page with that slug already exists" }); return; }
    console.error("restore deleted page failed:", err);
    res.status(500).json({ error: "Couldn't restore that page" });
  }
});

export default router;
