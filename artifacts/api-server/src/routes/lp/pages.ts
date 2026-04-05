import { getTenantId } from "../../middleware/requireAuth";
import { Router } from "express";
import { eq, asc, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { lpPagesTable } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

interface DbError {
  code?: string;
}

function isDbError(err: unknown): err is DbError {
  return typeof err === "object" && err !== null && "code" in err;
}

router.get("/lp/pages", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const pages = await db
      .select()
      .from(lpPagesTable)
      .where(eq(lpPagesTable.tenantId, tenantId))
      .orderBy(lpPagesTable.createdAt);
    res.json(pages);
  } catch (err) {
    const cause = (err as { cause?: Error })?.cause;
    console.error("GET /lp/pages error:", cause?.message ?? String(err));
    res.status(500).json({ error: "Failed to load pages" });
  }
});

// List all marketing-defined templates (pages with isTemplate = true)
router.get("/lp/templates", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const templates = await db
      .select()
      .from(lpPagesTable)
      .where(and(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.isTemplate, true)))
      .orderBy(asc(lpPagesTable.templateLabel));
    res.json(templates);
  } catch (err) {
    console.error("GET /lp/templates error:", String(err));
    res.status(500).json({ error: "Failed to load templates" });
  }
});

router.post("/lp/pages", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const {
    title, slug, blocks, status, customCss, metaTitle, metaDescription,
    ogImage, animationsEnabled, pageVariables, fromTemplateId,
  } = req.body as {
    title?: unknown;
    slug?: unknown;
    blocks?: unknown;
    status?: unknown;
    customCss?: unknown;
    metaTitle?: unknown;
    metaDescription?: unknown;
    ogImage?: unknown;
    animationsEnabled?: unknown;
    pageVariables?: unknown;
    fromTemplateId?: unknown;
  };
  if (!title || typeof title !== "string") {
    res.status(400).json({ error: "title is required" });
    return;
  }
  if (!slug || typeof slug !== "string") {
    res.status(400).json({ error: "slug is required" });
    return;
  }

  // If fromTemplateId is provided, copy all settings from that template page
  let sourceBlocks: unknown[] = [];
  let sourceCss = "";
  let sourceAnimationsEnabled = true;
  let sourceMetaTitle = "";
  let sourceMetaDescription = "";
  let sourceOgImage = "";
  let sourcePageVariables: Record<string, string> = {};
  if (typeof fromTemplateId === "number") {
    const [source] = await db.select().from(lpPagesTable).where(
      and(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.id, fromTemplateId))
    );
    if (source) {
      sourceBlocks = Array.isArray(source.blocks) ? source.blocks : [];
      sourceCss = source.customCss ?? "";
      sourceAnimationsEnabled = source.animationsEnabled ?? true;
      sourceMetaTitle = source.metaTitle ?? "";
      sourceMetaDescription = source.metaDescription ?? "";
      sourceOgImage = source.ogImage ?? "";
      sourcePageVariables = (source.pageVariables && typeof source.pageVariables === "object" && !Array.isArray(source.pageVariables))
        ? source.pageVariables as Record<string, string>
        : {};
    }
  }

  try {
    const [page] = await db
      .insert(lpPagesTable)
      .values({
        tenantId,
        title,
        slug,
        // When fromTemplateId is set, source content wins unless caller sends explicit non-empty overrides
        blocks: (Array.isArray(blocks) && blocks.length > 0) ? blocks : sourceBlocks,
        status: typeof status === "string" ? status : "draft",
        customCss: (typeof customCss === "string" && customCss.length > 0) ? customCss : sourceCss,
        metaTitle: typeof metaTitle === "string" && metaTitle.length > 0 ? metaTitle : sourceMetaTitle,
        metaDescription: typeof metaDescription === "string" && metaDescription.length > 0 ? metaDescription : sourceMetaDescription,
        ogImage: typeof ogImage === "string" && ogImage.length > 0 ? ogImage : sourceOgImage,
        animationsEnabled: typeof animationsEnabled === "boolean" ? animationsEnabled : sourceAnimationsEnabled,
        pageVariables: (pageVariables && typeof pageVariables === "object" && !Array.isArray(pageVariables))
          ? pageVariables as Record<string, string>
          : sourcePageVariables,
      })
      .returning();
    res.status(201).json(page);
  } catch (err) {
    if (isDbError(err) && err.code === "23505") {
      res.status(409).json({ error: "A page with that slug already exists" });
    } else {
      res.status(500).json({ error: "Failed to create page" });
    }
  }
});

router.get("/lp/pages/:pageId", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const id = parseInt(req.params.pageId, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid page ID" });
    return;
  }
  const [page] = await db.select().from(lpPagesTable).where(
    and(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.id, id))
  );
  if (!page) {
    res.status(404).json({ error: "Page not found" });
    return;
  }
  res.json(page);
});

router.put("/lp/pages/:pageId", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const id = parseInt(req.params.pageId, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid page ID" });
    return;
  }
  const { title, slug, blocks, status, customCss, metaTitle, metaDescription, ogImage, animationsEnabled, pageVariables } = req.body as {
    title?: string;
    slug?: string;
    blocks?: unknown[];
    status?: string;
    customCss?: string;
    metaTitle?: string;
    metaDescription?: string;
    ogImage?: string;
    animationsEnabled?: boolean;
    pageVariables?: Record<string, string>;
  };

  const updates: Partial<{ title: string; slug: string; blocks: unknown[]; status: string; customCss: string; metaTitle: string; metaDescription: string; ogImage: string; animationsEnabled: boolean; pageVariables: Record<string, string> }> = {};
  if (title !== undefined) updates.title = title;
  if (slug !== undefined) updates.slug = slug;
  if (blocks !== undefined) updates.blocks = blocks;
  if (status !== undefined) updates.status = status;
  if (customCss !== undefined) updates.customCss = customCss;
  if (metaTitle !== undefined) updates.metaTitle = metaTitle;
  if (metaDescription !== undefined) updates.metaDescription = metaDescription;
  if (ogImage !== undefined) updates.ogImage = ogImage;
  if (animationsEnabled !== undefined) updates.animationsEnabled = animationsEnabled;
  if (pageVariables !== undefined) updates.pageVariables = pageVariables;

  try {
    const [page] = await db
      .update(lpPagesTable)
      .set(updates)
      .where(and(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.id, id)))
      .returning();
    if (!page) {
      res.status(404).json({ error: "Page not found" });
      return;
    }
    res.json(page);
  } catch (err) {
    if (isDbError(err) && err.code === "23505") {
      res.status(409).json({ error: "A page with that slug already exists" });
    } else {
      res.status(500).json({ error: "Failed to update page" });
    }
  }
});

// Mark or unmark a page as a microsite template
router.patch("/lp/pages/:pageId/mark-template", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const id = parseInt(req.params.pageId, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid page ID" });
    return;
  }
  const { isTemplate, templateLabel, templateDescription } = req.body as {
    isTemplate?: boolean;
    templateLabel?: string;
    templateDescription?: string;
  };

  try {
    const [page] = await db
      .update(lpPagesTable)
      .set({
        isTemplate: typeof isTemplate === "boolean" ? isTemplate : true,
        templateLabel: typeof templateLabel === "string" ? templateLabel.trim() : null,
        templateDescription: typeof templateDescription === "string" ? templateDescription.trim() : null,
      })
      .where(and(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.id, id)))
      .returning();
    if (!page) {
      res.status(404).json({ error: "Page not found" });
      return;
    }
    res.json(page);
  } catch (err) {
    console.error("mark-template error:", err);
    res.status(500).json({ error: "Failed to update template status" });
  }
});

router.post("/lp/pages/:pageId/clone", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const id = parseInt(req.params.pageId, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid page ID" });
    return;
  }
  const [source] = await db.select().from(lpPagesTable).where(
    and(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.id, id))
  );
  if (!source) {
    res.status(404).json({ error: "Page not found" });
    return;
  }

  // Optional: link the clone to a specific account immediately
  const linkAccountId = req.body?.accountId ? Number(req.body.accountId) : null;

  const baseSlug = `${source.slug}-copy`;
  let slug = baseSlug;
  let suffix = 2;
  while (true) {
    const [existing] = await db.select({ id: lpPagesTable.id }).from(lpPagesTable).where(eq(lpPagesTable.slug, slug));
    if (!existing) break;
    slug = `${baseSlug}-${suffix++}`;
  }

  try {
    const [page] = await db
      .insert(lpPagesTable)
      .values({
        tenantId,
        title: `Copy of ${source.title}`,
        slug,
        blocks: Array.isArray(source.blocks) ? source.blocks : [],
        status: "draft",
        customCss: source.customCss ?? "",
        metaTitle: source.metaTitle ?? "",
        metaDescription: source.metaDescription ?? "",
        ogImage: source.ogImage ?? "",
        animationsEnabled: source.animationsEnabled ?? true,
        pageVariables: (source.pageVariables && typeof source.pageVariables === "object" && !Array.isArray(source.pageVariables)) ? source.pageVariables as Record<string, string> : {},
        ...(linkAccountId ? { accountId: linkAccountId } : {}),
      })
      .returning();
    res.status(201).json(page);
  } catch (err) {
    console.error("Clone page error:", err);
    res.status(500).json({ error: "Failed to clone page" });
  }
});

router.delete("/lp/pages/:pageId", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const id = parseInt(req.params.pageId, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid page ID" });
    return;
  }
  await db.delete(lpPagesTable).where(and(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.id, id)));
  res.json({ ok: true });
});

export default router;
