import { getTenantId, requirePermission, requireAuth } from "../../middleware/requireAuth";
import { Router } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { salesOnePagerTemplatesTable } from "@workspace/db";
import multer from "multer";
import { ObjectStorageService } from "../../lib/objectStorage";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const objectStorage = new ObjectStorageService();

const router = Router();

// ─── GET /sales/one-pager-templates ──────────────────────────
// List templates for the tenant.
// Sales reps (any authenticated user) get only active (non-deleted) templates.
// Admins with sales_campaigns also see soft-deleted templates for management.
router.get("/one-pager-templates", requireAuth, async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const isAdmin = req.authUser?.isAdmin || req.authUser?.permissions?.["sales_campaigns"] || false;

    const conditions = isAdmin
      ? [eq(salesOnePagerTemplatesTable.tenantId, tenantId)]
      : [
          eq(salesOnePagerTemplatesTable.tenantId, tenantId),
          eq(salesOnePagerTemplatesTable.isDeleted, false),
        ];

    const templates = await db
      .select()
      .from(salesOnePagerTemplatesTable)
      .where(and(...conditions))
      .orderBy(desc(salesOnePagerTemplatesTable.createdAt));
    res.json(templates);
  } catch (err) {
    req.log.error({ err }, "GET /sales/one-pager-templates error");
    res.status(500).json({ error: "Failed to load templates" });
  }
});

// ─── GET /sales/one-pager-templates/:id ──────────────────────
// Any authenticated user can fetch a single active (non-deleted) template.
// Admins can also fetch soft-deleted templates.
router.get("/one-pager-templates/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const isAdmin = req.authUser?.isAdmin || req.authUser?.permissions?.["sales_campaigns"] || false;

    const conditions = isAdmin
      ? [
          eq(salesOnePagerTemplatesTable.tenantId, tenantId),
          eq(salesOnePagerTemplatesTable.id, Number(req.params.id)),
        ]
      : [
          eq(salesOnePagerTemplatesTable.tenantId, tenantId),
          eq(salesOnePagerTemplatesTable.id, Number(req.params.id)),
          eq(salesOnePagerTemplatesTable.isDeleted, false),
        ];

    const [tpl] = await db
      .select()
      .from(salesOnePagerTemplatesTable)
      .where(and(...conditions));
    if (!tpl) { res.status(404).json({ error: "Template not found" }); return; }
    res.json(tpl);
  } catch (err) {
    req.log.error({ err }, "GET /sales/one-pager-templates/:id error");
    res.status(500).json({ error: "Failed to load template" });
  }
});

// ─── POST /sales/one-pager-templates ─────────────────────────
// Admin only: create a new template
router.post("/one-pager-templates", requirePermission("sales_campaigns"), async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const { name, background_url, orientation, fields, headerHeight, headerImageUrl } = req.body;
    if (!name) { res.status(400).json({ error: "name is required" }); return; }
    const [tpl] = await db
      .insert(salesOnePagerTemplatesTable)
      .values({
        tenantId,
        name: name.trim(),
        backgroundUrl: background_url || "",
        orientation: orientation || "portrait",
        fields: fields || [],
        headerHeight: headerHeight || 30,
        headerImageUrl: headerImageUrl || null,
        isDeleted: false,
      })
      .returning();
    res.status(201).json(tpl);
  } catch (err) {
    req.log.error({ err }, "POST /sales/one-pager-templates error");
    res.status(500).json({ error: "Failed to create template" });
  }
});

// ─── PATCH /sales/one-pager-templates/:id ────────────────────
// Admin only: update a template
router.patch("/one-pager-templates/:id", requirePermission("sales_campaigns"), async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const updates: Record<string, unknown> = {};
    if (req.body.name !== undefined) updates.name = String(req.body.name).trim();
    if (req.body.background_url !== undefined) updates.backgroundUrl = req.body.background_url;
    if (req.body.orientation !== undefined) updates.orientation = req.body.orientation;
    if (req.body.fields !== undefined) updates.fields = req.body.fields;
    if (req.body.headerHeight !== undefined) updates.headerHeight = req.body.headerHeight;
    if (req.body.headerImageUrl !== undefined) updates.headerImageUrl = req.body.headerImageUrl;
    if (req.body.isDeleted !== undefined) updates.isDeleted = req.body.isDeleted;

    const [updated] = await db
      .update(salesOnePagerTemplatesTable)
      .set(updates)
      .where(and(
        eq(salesOnePagerTemplatesTable.tenantId, tenantId),
        eq(salesOnePagerTemplatesTable.id, Number(req.params.id)),
      ))
      .returning();
    if (!updated) { res.status(404).json({ error: "Template not found" }); return; }
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "PATCH /sales/one-pager-templates/:id error");
    res.status(500).json({ error: "Failed to update template" });
  }
});

// ─── DELETE /sales/one-pager-templates/:id ───────────────────
// Admin only: hard delete
router.delete("/one-pager-templates/:id", requirePermission("sales_campaigns"), async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const [deleted] = await db
      .delete(salesOnePagerTemplatesTable)
      .where(and(
        eq(salesOnePagerTemplatesTable.tenantId, tenantId),
        eq(salesOnePagerTemplatesTable.id, Number(req.params.id)),
      ))
      .returning();
    if (!deleted) { res.status(404).json({ error: "Template not found" }); return; }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "DELETE /sales/one-pager-templates/:id error");
    res.status(500).json({ error: "Failed to delete template" });
  }
});

// ─── POST /sales/one-pager-templates/upload-bg ───────────────
// Admin only: upload a background image for a template
router.post("/one-pager-templates/upload-bg", requirePermission("sales_campaigns"), upload.single("file"), async (req, res): Promise<void> => {
  try {
    if (!req.file) { res.status(400).json({ error: "No file provided" }); return; }
    const path = await objectStorage.uploadObjectEntity(req.file.buffer, req.file.mimetype);
    res.json({ url: path });
  } catch (err) {
    req.log.error({ err }, "POST /sales/one-pager-templates/upload-bg error");
    res.status(500).json({ error: "Upload failed" });
  }
});

export default router;
