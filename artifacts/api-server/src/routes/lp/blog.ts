// First-party marketing blog (blog_posts) — LP Studio's OWN blog, NOT
// per-tenant. Authored from /superadmin, rendered on the public marketing apex
// (lpstudio.ai/blog) for SEO + GEO.
//
//  PUBLIC (no auth — listed in LP_PUBLIC so they skip the blanket /lp/* gate;
//  CORS-open so the apex marketing app can read them cross-origin):
//   - GET /lp/blog/posts            — published only, paginated, newest first,
//                                     optional ?tag= filter. Returns list cards
//                                     (no body) to keep the index payload small.
//   - GET /lp/blog/posts/:slug      — a single PUBLISHED post (full body). 404
//                                     for drafts / unknown slugs.
//   - GET /lp/blog/sitemap.xml      — apex blog sitemap (published posts).
//   All three are rate-limited with the shared rateLimit util.
//
//  SUPERADMIN (gated by requireSuperadmin directly, mirroring
//  featured-templates.ts / adminTemplates.ts):
//   - GET    /admin/blog/posts        — ALL posts incl. drafts.
//   - GET    /admin/blog/posts/:id    — one post by id (full row).
//   - POST   /admin/blog/posts        — create (slug auto-from-title, reading
//                                       time computed, publishedAt stamped if
//                                       published).
//   - PUT    /admin/blog/posts/:id    — update (slug regen on title change with
//                                       collision handling; publish/unpublish via
//                                       status; publishedAt stamped on first
//                                       publish).
//   - DELETE /admin/blog/posts/:id    — delete.
//
// The public GETs are added to LP_PUBLIC in routes/index.ts. body is sanitized
// HTML stored as text (Phase 1 migration) and RE-sanitized on the FE at render.

import { Router } from "express";
import { db, blogPostsTable } from "@workspace/db";
import { and, eq, desc, sql } from "drizzle-orm";
import { requireSuperadmin } from "../../middleware/requireSuperadmin";
import { rateLimit, envLimit } from "../../lib/rateLimit";
import {
  slugifyTitle,
  uniqueSlug,
  readingTimeMin,
  normalizeStatus,
  normalizeTags,
} from "../../lib/blog";

const router = Router();

// Apex domain — public post URLs live under lpstudio.ai/blog/:slug.
const PUBLIC_BLOG_BASE = "https://lpstudio.ai";

// Public read limiter — generous (these are cacheable GETs) but bounded so a
// scraper flood can't hammer the DB.
const publicBlogLimiter = rateLimit({
  name: "blog-public",
  windowMs: 60_000,
  max: envLimit("RATE_LIMIT_BLOG_PUBLIC_PER_MIN", 120),
});

type Row = typeof blogPostsTable.$inferSelect;

function toTags(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((t): t is string => typeof t === "string") : [];
}

// Public card shape — list view. No body (keeps the index light).
function toPublicCard(r: Row) {
  return {
    slug: r.slug,
    title: r.title,
    excerpt: r.excerpt,
    coverImageUrl: r.coverImageUrl ?? null,
    authorName: r.authorName,
    tags: toTags(r.tags),
    readingTimeMin: r.readingTimeMin,
    publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
  };
}

// Public full shape — single post. Includes body + SEO/OG fields so the FE can
// render the article and set per-post meta + JSON-LD.
function toPublicFull(r: Row) {
  return {
    ...toPublicCard(r),
    body: r.body,
    seoTitle: r.seoTitle ?? null,
    seoDescription: r.seoDescription ?? null,
    ogImageUrl: r.ogImageUrl ?? null,
    updatedAt: r.updatedAt ? r.updatedAt.toISOString() : null,
  };
}

// Admin shape — every column, so the editor can round-trip the full row.
function toAdmin(r: Row) {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    excerpt: r.excerpt,
    body: r.body,
    coverImageUrl: r.coverImageUrl ?? "",
    authorName: r.authorName,
    tags: toTags(r.tags),
    status: r.status,
    seoTitle: r.seoTitle ?? "",
    seoDescription: r.seoDescription ?? "",
    ogImageUrl: r.ogImageUrl ?? "",
    readingTimeMin: r.readingTimeMin,
    publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
    createdAt: r.createdAt ? r.createdAt.toISOString() : null,
    updatedAt: r.updatedAt ? r.updatedAt.toISOString() : null,
  };
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ── PUBLIC ──────────────────────────────────────────────────────────────────

// GET /lp/blog/posts — published only, newest first, paginated, optional ?tag=.
router.get("/lp/blog/posts", publicBlogLimiter, async (req, res): Promise<void> => {
  try {
    const pageRaw = Number(req.query.page);
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.trunc(pageRaw) : 1;
    const sizeRaw = Number(req.query.pageSize);
    const pageSize =
      Number.isFinite(sizeRaw) && sizeRaw > 0 ? Math.min(50, Math.trunc(sizeRaw)) : 12;
    const tag = typeof req.query.tag === "string" ? req.query.tag.trim() : "";

    const conditions = [eq(blogPostsTable.status, "published")];
    // Tag filter: jsonb array containment (tags @> '["<tag>"]'). Parameterized.
    if (tag) {
      conditions.push(sql`${blogPostsTable.tags} @> ${JSON.stringify([tag])}::jsonb`);
    }
    const where = and(...conditions);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(blogPostsTable)
      .where(where);

    const rows = await db
      .select()
      .from(blogPostsTable)
      .where(where)
      .orderBy(desc(blogPostsTable.publishedAt), desc(blogPostsTable.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    res.set("Cache-Control", "public, max-age=60, s-maxage=300");
    res.json({
      posts: rows.map(toPublicCard),
      page,
      pageSize,
      total: count ?? 0,
      hasMore: page * pageSize < (count ?? 0),
    });
  } catch (err) {
    console.error("GET /lp/blog/posts error:", String(err));
    res.status(500).json({ error: "Failed to load posts" });
  }
});

// GET /lp/blog/sitemap.xml — published posts for the apex blog. Mounted before
// /:slug so "sitemap.xml" isn't captured as a slug.
router.get("/lp/blog/sitemap.xml", publicBlogLimiter, async (_req, res): Promise<void> => {
  try {
    const rows = await db
      .select({
        slug: blogPostsTable.slug,
        updatedAt: blogPostsTable.updatedAt,
        publishedAt: blogPostsTable.publishedAt,
      })
      .from(blogPostsTable)
      .where(eq(blogPostsTable.status, "published"))
      .orderBy(desc(blogPostsTable.publishedAt));

    const urls = rows
      .map((r) => {
        const loc = `${PUBLIC_BLOG_BASE}/blog/${encodeURIComponent(r.slug)}`;
        const lastmod = (r.updatedAt ?? r.publishedAt) ?? null;
        let entry = `  <url>\n    <loc>${escapeXml(loc)}</loc>\n`;
        if (lastmod instanceof Date && !Number.isNaN(lastmod.getTime())) {
          entry += `    <lastmod>${lastmod.toISOString()}</lastmod>\n`;
        }
        entry += `  </url>`;
        return entry;
      })
      .join("\n");
    // The /blog index itself is always indexable.
    const indexEntry = `  <url>\n    <loc>${PUBLIC_BLOG_BASE}/blog</loc>\n  </url>`;
    const body = `\n${indexEntry}${urls ? `\n${urls}` : ""}\n`;

    res.set("Content-Type", "application/xml; charset=utf-8");
    res.set("Cache-Control", "public, max-age=60, s-maxage=300");
    res.send(
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>\n`,
    );
  } catch (err) {
    console.error("GET /lp/blog/sitemap.xml error:", String(err));
    res.status(500).send("Internal server error");
  }
});

// GET /lp/blog/posts/:slug — a single PUBLISHED post. Drafts + unknown → 404.
router.get("/lp/blog/posts/:slug", publicBlogLimiter, async (req, res): Promise<void> => {
  const slug = String(req.params.slug || "").trim();
  if (!slug) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  try {
    const [row] = await db
      .select()
      .from(blogPostsTable)
      .where(and(eq(blogPostsTable.slug, slug), eq(blogPostsTable.status, "published")))
      .limit(1);
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.set("Cache-Control", "public, max-age=60, s-maxage=300");
    res.json({ post: toPublicFull(row) });
  } catch (err) {
    console.error("GET /lp/blog/posts/:slug error:", String(err));
    res.status(500).json({ error: "Failed to load post" });
  }
});

// ── SUPERADMIN ────────────────────────────────────────────────────────────────

// GET /admin/blog/posts — ALL posts incl. drafts, newest-edited first.
router.get("/admin/blog/posts", requireSuperadmin, async (_req, res): Promise<void> => {
  try {
    const rows = await db
      .select()
      .from(blogPostsTable)
      .orderBy(desc(blogPostsTable.updatedAt), desc(blogPostsTable.id));
    res.json({ posts: rows.map(toAdmin) });
  } catch (err) {
    console.error("GET /admin/blog/posts error:", String(err));
    res.status(500).json({ error: "Failed to load posts" });
  }
});

// GET /admin/blog/posts/:id — single post by id (full row).
router.get("/admin/blog/posts/:id", requireSuperadmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    const [row] = await db.select().from(blogPostsTable).where(eq(blogPostsTable.id, id)).limit(1);
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ post: toAdmin(row) });
  } catch (err) {
    console.error("GET /admin/blog/posts/:id error:", String(err));
    res.status(500).json({ error: "Failed to load post" });
  }
});

interface IncomingPost {
  title?: unknown;
  slug?: unknown;
  excerpt?: unknown;
  body?: unknown;
  coverImageUrl?: unknown;
  authorName?: unknown;
  tags?: unknown;
  status?: unknown;
  seoTitle?: unknown;
  seoDescription?: unknown;
  ogImageUrl?: unknown;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function nullableStr(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s : null;
}

async function allSlugs(): Promise<string[]> {
  const rows = await db.select({ slug: blogPostsTable.slug }).from(blogPostsTable);
  return rows.map((r) => r.slug);
}

// POST /admin/blog/posts — create.
router.post("/admin/blog/posts", requireSuperadmin, async (req, res): Promise<void> => {
  const b = (req.body ?? {}) as IncomingPost;
  const title = str(b.title).trim();
  if (!title) {
    res.status(400).json({ error: "title is required" });
    return;
  }
  try {
    const status = normalizeStatus(b.status);
    const requestedSlug = str(b.slug).trim();
    const slugBase = requestedSlug ? slugifyTitle(requestedSlug) : title;
    const slug = uniqueSlug(slugBase, await allSlugs());
    const body = str(b.body);

    const [row] = await db
      .insert(blogPostsTable)
      .values({
        slug,
        title,
        excerpt: str(b.excerpt),
        body,
        coverImageUrl: nullableStr(b.coverImageUrl),
        authorName: str(b.authorName).trim() || "LP Studio",
        tags: normalizeTags(b.tags),
        status,
        seoTitle: nullableStr(b.seoTitle),
        seoDescription: nullableStr(b.seoDescription),
        ogImageUrl: nullableStr(b.ogImageUrl),
        readingTimeMin: readingTimeMin(body),
        publishedAt: status === "published" ? new Date() : null,
      })
      .returning();
    res.status(201).json({ post: toAdmin(row) });
  } catch (err) {
    console.error("POST /admin/blog/posts error:", String(err));
    res.status(500).json({ error: "Failed to create post" });
  }
});

// PUT /admin/blog/posts/:id — update (incl. publish/unpublish).
router.put("/admin/blog/posts/:id", requireSuperadmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const b = (req.body ?? {}) as IncomingPost;
  const title = str(b.title).trim();
  if (!title) {
    res.status(400).json({ error: "title is required" });
    return;
  }
  try {
    const [existing] = await db
      .select()
      .from(blogPostsTable)
      .where(eq(blogPostsTable.id, id))
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const status = normalizeStatus(b.status);
    // Slug: honour an explicit non-empty slug, else regenerate from title.
    // Either way de-dupe against every OTHER post (excluding this row's
    // current slug so a no-op save keeps it).
    const requestedSlug = str(b.slug).trim();
    const slugBase = requestedSlug ? slugifyTitle(requestedSlug) : title;
    const slug = uniqueSlug(slugBase, await allSlugs(), existing.slug);
    const body = str(b.body);

    // Stamp publishedAt on FIRST publish; preserve it across edits; clear it on
    // unpublish so re-publishing restamps "newest".
    let publishedAt: Date | null = existing.publishedAt ?? null;
    if (status === "published" && !existing.publishedAt) publishedAt = new Date();
    if (status !== "published") publishedAt = null;

    const [row] = await db
      .update(blogPostsTable)
      .set({
        slug,
        title,
        excerpt: str(b.excerpt),
        body,
        coverImageUrl: nullableStr(b.coverImageUrl),
        authorName: str(b.authorName).trim() || "LP Studio",
        tags: normalizeTags(b.tags),
        status,
        seoTitle: nullableStr(b.seoTitle),
        seoDescription: nullableStr(b.seoDescription),
        ogImageUrl: nullableStr(b.ogImageUrl),
        readingTimeMin: readingTimeMin(body),
        publishedAt,
      })
      .where(eq(blogPostsTable.id, id))
      .returning();
    res.json({ post: toAdmin(row) });
  } catch (err) {
    console.error("PUT /admin/blog/posts/:id error:", String(err));
    res.status(500).json({ error: "Failed to update post" });
  }
});

// DELETE /admin/blog/posts/:id — delete.
router.delete("/admin/blog/posts/:id", requireSuperadmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    const deleted = await db
      .delete(blogPostsTable)
      .where(eq(blogPostsTable.id, id))
      .returning({ id: blogPostsTable.id });
    if (deleted.length === 0) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /admin/blog/posts/:id error:", String(err));
    res.status(500).json({ error: "Failed to delete post" });
  }
});

export default router;
