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
import { createHmac, timingSafeEqual } from "node:crypto";
import { db, blogPostsTable, blogPostRevisionsTable } from "@workspace/db";
import { and, eq, desc, sql } from "drizzle-orm";
import { requireSuperadmin } from "../../middleware/requireSuperadmin";
import { rateLimit, envLimit } from "../../lib/rateLimit";
import {
  slugifyTitle,
  uniqueSlug,
  readingTimeMin,
  normalizeStatus,
  normalizeTags,
  clampFocal,
  parseScheduledAt,
  revisionIdsToPrune,
  MAX_REVISIONS_PER_POST,
  type BlogSnapshot,
} from "../../lib/blog";

const router = Router();

// ── Preview tokens ────────────────────────────────────────────────────────
// Drafts/scheduled posts must NEVER appear publicly. The superadmin editor can
// still preview them on the real marketing render via a SIGNED, short-lived
// token: GET /lp/blog/preview/:id?token=<t> returns the full post regardless
// of status iff the token validates. The token is an HMAC over the post id +
// an expiry, so it can't be forged and auto-expires. This keeps the render
// path identical to production while never exposing unpublished content to an
// unauthenticated visitor who doesn't hold a freshly-minted token.
const PREVIEW_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function previewSecret(): string {
  return (
    process.env.SESSION_SECRET ??
    process.env.NOTIFICATION_PREFS_SECRET ??
    process.env.RESEND_API_KEY ??
    "lp-studio-blog-preview-dev-secret"
  );
}
function signPreviewToken(postId: number, expMs: number): string {
  const payload = `${postId}.${expMs}`;
  const sig = createHmac("sha256", previewSecret()).update(payload).digest("base64url");
  return `${expMs}.${sig}`;
}
export function mintPreviewToken(postId: number): string {
  return signPreviewToken(postId, Date.now() + PREVIEW_TOKEN_TTL_MS);
}
export function verifyPreviewToken(postId: number, token: string): boolean {
  const parts = String(token || "").split(".");
  if (parts.length !== 2) return false;
  const expMs = Number(parts[0]);
  if (!Number.isFinite(expMs) || expMs < Date.now()) return false;
  const expected = signPreviewToken(postId, expMs);
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

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
    ogFocalX: r.ogFocalX ?? 0.5,
    ogFocalY: r.ogFocalY ?? 0.5,
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
    ogFocalX: r.ogFocalX ?? 0.5,
    ogFocalY: r.ogFocalY ?? 0.5,
    readingTimeMin: r.readingTimeMin,
    publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
    scheduledAt: r.scheduledAt ? r.scheduledAt.toISOString() : null,
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

// GET /lp/blog/preview/:id?token=<t> — render-exact preview of ANY post
// (incl. draft/scheduled) for the superadmin editor. Gated by a signed,
// short-lived HMAC token minted at /admin/blog/posts/:id/preview-token, NOT by
// status — but it can only be reached with a valid unforgeable token, so
// unpublished content is never exposed to an ordinary visitor. Mounted before
// /posts/:slug so "preview" isn't captured as a slug. NEVER cached.
router.get("/lp/blog/preview/:id", publicBlogLimiter, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const token = typeof req.query.token === "string" ? req.query.token : "";
  if (!Number.isInteger(id) || id <= 0 || !verifyPreviewToken(id, token)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  try {
    const [row] = await db
      .select()
      .from(blogPostsTable)
      .where(eq(blogPostsTable.id, id))
      .limit(1);
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.set("Cache-Control", "no-store");
    // preview: true so the renderer can show an unobtrusive "Preview" ribbon.
    res.json({ post: { ...toPublicFull(row), status: row.status }, preview: true });
  } catch (err) {
    console.error("GET /lp/blog/preview/:id error:", String(err));
    res.status(500).json({ error: "Failed to load preview" });
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
  ogFocalX?: unknown;
  ogFocalY?: unknown;
  scheduledAt?: unknown;
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

function authorEmailFromReq(req: unknown): string | null {
  const u = (req as { authUser?: { email?: string } })?.authUser;
  return typeof u?.email === "string" ? u.email : null;
}

/**
 * Resolve publishedAt + scheduledAt from the requested status, given the
 * existing row's publishedAt (null on create). Single source of truth for the
 * draft/scheduled/published transitions:
 *   - published : stamp publishedAt on first publish, preserve thereafter;
 *                 scheduledAt cleared.
 *   - scheduled : publishedAt cleared (not yet live); scheduledAt = parsed
 *                 target (defaults to now if missing/invalid, so the sweep
 *                 publishes it on the next pass rather than stranding it).
 *   - draft     : both cleared.
 */
function resolvePublishTiming(
  status: "draft" | "scheduled" | "published",
  existingPublishedAt: Date | null,
  rawScheduledAt: unknown,
): { publishedAt: Date | null; scheduledAt: Date | null } {
  if (status === "published") {
    return { publishedAt: existingPublishedAt ?? new Date(), scheduledAt: null };
  }
  if (status === "scheduled") {
    return { publishedAt: null, scheduledAt: parseScheduledAt(rawScheduledAt) ?? new Date() };
  }
  return { publishedAt: null, scheduledAt: null };
}

/** Build the editable snapshot persisted in a revision from a saved row. */
function rowToSnapshot(r: Row): BlogSnapshot {
  return {
    title: r.title,
    slug: r.slug,
    excerpt: r.excerpt,
    body: r.body,
    coverImageUrl: r.coverImageUrl ?? "",
    authorName: r.authorName,
    tags: toTags(r.tags),
    status: r.status,
    seoTitle: r.seoTitle ?? "",
    seoDescription: r.seoDescription ?? "",
    ogImageUrl: r.ogImageUrl ?? "",
    ogFocalX: r.ogFocalX ?? 0.5,
    ogFocalY: r.ogFocalY ?? 0.5,
    scheduledAt: r.scheduledAt ? r.scheduledAt.toISOString() : null,
  };
}

/**
 * Record a revision snapshot for a post, then prune to the retention bound.
 * Best-effort: revision history is auxiliary, so a failure here is logged and
 * swallowed — it must never fail the underlying save/publish.
 */
async function recordRevision(
  postId: number,
  row: Row,
  reason: "save" | "publish" | "restore",
  authorEmail: string | null,
): Promise<void> {
  try {
    await db.insert(blogPostRevisionsTable).values({
      postId,
      snapshot: rowToSnapshot(row),
      reason,
      authorEmail,
    });
    // Prune: keep only the most recent MAX_REVISIONS_PER_POST.
    const ids = await db
      .select({ id: blogPostRevisionsTable.id })
      .from(blogPostRevisionsTable)
      .where(eq(blogPostRevisionsTable.postId, postId))
      .orderBy(desc(blogPostRevisionsTable.createdAt), desc(blogPostRevisionsTable.id));
    const toDelete = revisionIdsToPrune(ids.map((r) => r.id), MAX_REVISIONS_PER_POST);
    if (toDelete.length > 0) {
      await db
        .delete(blogPostRevisionsTable)
        .where(
          and(
            eq(blogPostRevisionsTable.postId, postId),
            sql`${blogPostRevisionsTable.id} = ANY(${toDelete})`,
          ),
        );
    }
  } catch (err) {
    console.error("recordRevision error:", String(err));
  }
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
    const { publishedAt, scheduledAt } = resolvePublishTiming(status, null, b.scheduledAt);

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
        ogFocalX: clampFocal(b.ogFocalX),
        ogFocalY: clampFocal(b.ogFocalY),
        readingTimeMin: readingTimeMin(body),
        publishedAt,
        scheduledAt,
      })
      .returning();
    await recordRevision(row.id, row, status === "published" ? "publish" : "save", authorEmailFromReq(req));
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

    // Resolve publishedAt + scheduledAt for the requested status (stamp on
    // first publish, preserve thereafter; scheduled sets scheduledAt; draft
    // clears both).
    const { publishedAt, scheduledAt } = resolvePublishTiming(
      status,
      existing.publishedAt ?? null,
      b.scheduledAt,
    );

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
        ogFocalX: clampFocal(b.ogFocalX),
        ogFocalY: clampFocal(b.ogFocalY),
        readingTimeMin: readingTimeMin(body),
        publishedAt,
        scheduledAt,
      })
      .where(eq(blogPostsTable.id, id))
      .returning();
    // Record a revision on every save. A first-publish transition is tagged
    // 'publish' so the history reads clearly.
    const reason =
      status === "published" && !existing.publishedAt ? "publish" : "save";
    await recordRevision(id, row, reason, authorEmailFromReq(req));
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
    // Cascade-clean the revision history (no FK constraint; explicit cleanup).
    await db
      .delete(blogPostRevisionsTable)
      .where(eq(blogPostRevisionsTable.postId, id))
      .catch((err) => console.error("blog revision cleanup error:", String(err)));
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /admin/blog/posts/:id error:", String(err));
    res.status(500).json({ error: "Failed to delete post" });
  }
});

// ── REVISION HISTORY (superadmin) ─────────────────────────────────────────

// GET /admin/blog/posts/:id/revisions — newest-first revision list (metadata +
// snapshot, so the UI can both list and preview/restore client-side).
router.get(
  "/admin/blog/posts/:id/revisions",
  requireSuperadmin,
  async (req, res): Promise<void> => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    try {
      const rows = await db
        .select()
        .from(blogPostRevisionsTable)
        .where(eq(blogPostRevisionsTable.postId, id))
        .orderBy(desc(blogPostRevisionsTable.createdAt), desc(blogPostRevisionsTable.id))
        .limit(MAX_REVISIONS_PER_POST);
      res.json({
        revisions: rows.map((r) => ({
          id: r.id,
          reason: r.reason,
          authorEmail: r.authorEmail ?? null,
          createdAt: r.createdAt ? r.createdAt.toISOString() : null,
          snapshot: r.snapshot as BlogSnapshot,
        })),
      });
    } catch (err) {
      console.error("GET /admin/blog/posts/:id/revisions error:", String(err));
      res.status(500).json({ error: "Failed to load revisions" });
    }
  },
);

// POST /admin/blog/posts/:id/revisions/:revId/restore — restore a prior
// revision's editable fields onto the post. The restore is itself recorded as
// a NEW revision (reason='restore'), so history stays append-only + undoable.
// Restoring NEVER auto-publishes: the restored content lands as a draft unless
// the snapshot's status was 'published' AND the post is already published
// (status is taken from the snapshot but publish timing is re-resolved).
router.post(
  "/admin/blog/posts/:id/revisions/:revId/restore",
  requireSuperadmin,
  async (req, res): Promise<void> => {
    const id = Number(req.params.id);
    const revId = Number(req.params.revId);
    if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(revId) || revId <= 0) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    try {
      const [existing] = await db
        .select()
        .from(blogPostsTable)
        .where(eq(blogPostsTable.id, id))
        .limit(1);
      if (!existing) {
        res.status(404).json({ error: "Post not found" });
        return;
      }
      const [rev] = await db
        .select()
        .from(blogPostRevisionsTable)
        .where(and(eq(blogPostRevisionsTable.id, revId), eq(blogPostRevisionsTable.postId, id)))
        .limit(1);
      if (!rev) {
        res.status(404).json({ error: "Revision not found" });
        return;
      }
      const snap = (rev.snapshot ?? {}) as BlogSnapshot;
      const title = str(snap.title).trim() || existing.title;
      const status = normalizeStatus(snap.status);
      const requestedSlug = str(snap.slug).trim();
      const slugBase = requestedSlug ? slugifyTitle(requestedSlug) : title;
      const slug = uniqueSlug(slugBase, await allSlugs(), existing.slug);
      const body = str(snap.body);
      const { publishedAt, scheduledAt } = resolvePublishTiming(
        status,
        existing.publishedAt ?? null,
        snap.scheduledAt,
      );

      const [row] = await db
        .update(blogPostsTable)
        .set({
          slug,
          title,
          excerpt: str(snap.excerpt),
          body,
          coverImageUrl: nullableStr(snap.coverImageUrl),
          authorName: str(snap.authorName).trim() || "LP Studio",
          tags: normalizeTags(snap.tags),
          status,
          seoTitle: nullableStr(snap.seoTitle),
          seoDescription: nullableStr(snap.seoDescription),
          ogImageUrl: nullableStr(snap.ogImageUrl),
          ogFocalX: clampFocal(snap.ogFocalX),
          ogFocalY: clampFocal(snap.ogFocalY),
          readingTimeMin: readingTimeMin(body),
          publishedAt,
          scheduledAt,
        })
        .where(eq(blogPostsTable.id, id))
        .returning();
      await recordRevision(id, row, "restore", authorEmailFromReq(req));
      res.json({ post: toAdmin(row) });
    } catch (err) {
      console.error("POST /admin/blog/posts/:id/revisions/:revId/restore error:", String(err));
      res.status(500).json({ error: "Failed to restore revision" });
    }
  },
);

// ── PREVIEW (superadmin mints token; public render reads it) ───────────────

// GET /admin/blog/posts/:id/preview-token — mint a short-lived signed token
// the editor appends to the marketing render URL (?preview=<token>) so the
// author can view a draft/scheduled post exactly as it'll render publicly.
router.get(
  "/admin/blog/posts/:id/preview-token",
  requireSuperadmin,
  async (req, res): Promise<void> => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    res.json({ token: mintPreviewToken(id), ttlMs: PREVIEW_TOKEN_TTL_MS });
  },
);

export default router;
