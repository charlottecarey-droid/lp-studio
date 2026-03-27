import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { lpPagesTable } from "@workspace/db";

const router = Router();

interface DbError {
  code?: string;
}

function isDbError(err: unknown): err is DbError {
  return typeof err === "object" && err !== null && "code" in err;
}

router.get("/lp/pages", async (_req, res): Promise<void> => {
  try {
    const pages = await db
      .select()
      .from(lpPagesTable)
      .orderBy(lpPagesTable.createdAt);
    res.json(pages);
  } catch (err) {
    const cause = (err as { cause?: Error })?.cause;
    console.error("GET /lp/pages error:", cause?.message ?? String(err));
    res.status(500).json({ error: "Failed to load pages", detail: cause?.message ?? String(err) });
  }
});

router.post("/lp/pages", async (req, res): Promise<void> => {
  const { title, slug, blocks, status, customCss, metaTitle, metaDescription, ogImage, animationsEnabled, pageVariables } = req.body as {
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
  };
  if (!title || typeof title !== "string") {
    res.status(400).json({ error: "title is required" });
    return;
  }
  if (!slug || typeof slug !== "string") {
    res.status(400).json({ error: "slug is required" });
    return;
  }
  try {
    const [page] = await db
      .insert(lpPagesTable)
      .values({
        title,
        slug,
        blocks: Array.isArray(blocks) ? blocks : [],
        status: typeof status === "string" ? status : "draft",
        customCss: typeof customCss === "string" ? customCss : "",
        metaTitle: typeof metaTitle === "string" ? metaTitle : "",
        metaDescription: typeof metaDescription === "string" ? metaDescription : "",
        ogImage: typeof ogImage === "string" ? ogImage : "",
        animationsEnabled: typeof animationsEnabled === "boolean" ? animationsEnabled : true,
        pageVariables: (pageVariables && typeof pageVariables === "object" && !Array.isArray(pageVariables)) ? pageVariables as Record<string, string> : {},
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
  const id = parseInt(req.params.pageId, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid page ID" });
    return;
  }
  const [page] = await db.select().from(lpPagesTable).where(eq(lpPagesTable.id, id));
  if (!page) {
    res.status(404).json({ error: "Page not found" });
    return;
  }
  res.json(page);
});

router.put("/lp/pages/:pageId", async (req, res): Promise<void> => {
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
      .where(eq(lpPagesTable.id, id))
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

router.delete("/lp/pages/:pageId", async (req, res): Promise<void> => {
  const id = parseInt(req.params.pageId, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid page ID" });
    return;
  }
  await db.delete(lpPagesTable).where(eq(lpPagesTable.id, id));
  res.json({ ok: true });
});

export default router;
