import {
  pgTable,
  serial,
  text,
  integer,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
  doublePrecision,
} from "drizzle-orm/pg-core";

/**
 * blog_posts — LP Studio's own first-party marketing blog (June 2026).
 *
 * SINGLE first-party blog, NOT per-tenant. This is the blog the LP Studio
 * owner/superadmin writes and publishes for the PUBLIC marketing site
 * (lpstudio.ai/blog), built for SEO + GEO (AI-citability). It is authored
 * from /superadmin and rendered on the marketing apex — neither surface is
 * tenant-scoped, so there is deliberately NO `tenant_id` column. (Contrast
 * with `conversations`, `lp_pages`, etc., which ARE tenant-scoped because
 * they hold per-customer data. The blog is platform content, like
 * `featured_homepage_templates` and `marketing_homepage_og`, which are also
 * un-scoped superadmin-owned marketing config.)
 *
 * BODY FORMAT: sanitized HTML stored as TEXT (Phase 1 migration, June 2026 —
 * was markdown). The column keeps its name (`body`); HTML fits in `text`, so no
 * rename/dual-read was needed. Authoring moved to a Tiptap WYSIWYG (the same
 * rich-text editor the email builder uses) plus a raw-HTML/SVG code view for
 * infographics + embeds. It is RE-SANITIZED on the FRONTEND at render time (see
 * artifacts/lp-studio/src/marketing/lib/sanitizeBlogHtml.ts) — stored HTML is
 * authored by trusted superadmins but shown on the PUBLIC site, so it is never
 * trusted: a tag/attr allowlist permits semantic editorial tags, inline <svg>
 * infographics, and <iframe> from an embed-host allowlist (YouTube/Vimeo/Loom),
 * while stripping <script>, on* handlers, and javascript:/non-image data: URLs.
 * Legacy markdown rows are converted to HTML once via a marker-gated heal in
 * migrate.ts (see markdownToHtml in artifacts/api-server/src/lib/blogHtml.ts).
 *
 *   slug             — URL slug (unique). Auto-derived from title on save with
 *                      collision handling (-2, -3, …).
 *   title            — H1 / card title.
 *   excerpt          — short subtitle / dek shown on cards + used as the meta
 *                      description fallback.
 *   body             — sanitized HTML source (see BODY FORMAT above).
 *   coverImageUrl    — hero/card image (absolute or /api/storage relative).
 *   authorName       — byline.
 *   tags             — jsonb array of strings for filtering + the kicker.
 *   status           — 'draft' | 'scheduled' | 'published'. Public endpoints
 *                      return ONLY 'published'; superadmin sees all. 'scheduled'
 *                      posts auto-flip to 'published' by the blogPublishPoller
 *                      sweep when scheduledAt <= now (Phase 2).
 *   seoTitle         — <title> override (falls back to title).
 *   seoDescription   — meta description override (falls back to excerpt).
 *   ogImageUrl       — social share image override (falls back to coverImageUrl).
 *   ogFocalX/Y       — Phase 2. Focal point (0–1, default 0.5) for the OG/social
 *                      card crop. We do NOT derive a cropped image; instead the
 *                      stored OG image is rendered into the 1200×630 (1.91:1)
 *                      social frame with CSS object-position: <x*100>% <y*100>%,
 *                      so any source aspect crops correctly around the subject.
 *                      Simpler + robust: no second upload, no orphaned derivatives.
 *   readingTimeMin   — computed on save from the body word count.
 *   publishedAt      — set when first published; drives ordering + JSON-LD
 *                      datePublished + sitemap lastmod.
 *   scheduledAt      — Phase 2. When status='scheduled', the time the sweep
 *                      should auto-publish. NULL for draft/published.
 */
export const blogPostsTable = pgTable(
  "blog_posts",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    excerpt: text("excerpt").notNull().default(""),
    body: text("body").notNull().default(""),
    coverImageUrl: text("cover_image_url"),
    authorName: text("author_name").notNull().default("LP Studio"),
    tags: jsonb("tags").notNull().default([]),
    status: text("status").notNull().default("draft"),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    ogImageUrl: text("og_image_url"),
    // OG focal point (0–1). Renderer maps to object-position; default centre.
    ogFocalX: doublePrecision("og_focal_x").notNull().default(0.5),
    ogFocalY: doublePrecision("og_focal_y").notNull().default(0.5),
    readingTimeMin: integer("reading_time_min").notNull().default(1),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    // Phase 2 — scheduled-publish target. Set when status='scheduled'.
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    slugUnique: uniqueIndex("blog_posts_slug_unique").on(t.slug),
    statusPublishedIdx: index("blog_posts_status_published_idx").on(
      t.status,
      t.publishedAt,
    ),
    // Partial-style index supporting the scheduled-publish sweep's hot query
    // (status='scheduled' AND scheduled_at <= now()).
    statusScheduledIdx: index("blog_posts_status_scheduled_idx").on(
      t.status,
      t.scheduledAt,
    ),
  }),
);

export type BlogPost = typeof blogPostsTable.$inferSelect;
export type NewBlogPost = typeof blogPostsTable.$inferInsert;

/**
 * blog_post_revisions — Phase 2 version history for the first-party blog.
 *
 * One row per save/publish/restore, capturing a snapshot of the editable
 * fields (body HTML + title + meta + image config). The editor lists these and
 * can RESTORE any of them; a restore writes the restored content back to
 * blog_posts AND records a NEW revision (so history is append-only and a
 * restore is itself undoable). Retention is bounded (last N kept per post,
 * pruned on insert — see pruneRevisions) so the table can't grow unbounded.
 *
 * Not tenant-scoped, same rationale as blog_posts (superadmin platform content).
 * snapshot is the full editable field-set as jsonb so adding editable fields
 * later doesn't need a schema change. authorEmail is the superadmin who saved.
 */
export const blogPostRevisionsTable = pgTable(
  "blog_post_revisions",
  {
    id: serial("id").primaryKey(),
    postId: integer("post_id").notNull(),
    // Full editable snapshot: { title, slug, excerpt, body, coverImageUrl,
    // authorName, tags, status, seoTitle, seoDescription, ogImageUrl,
    // ogFocalX, ogFocalY, scheduledAt }.
    snapshot: jsonb("snapshot").notNull().default({}),
    // 'save' | 'publish' | 'restore' — why this revision was written.
    reason: text("reason").notNull().default("save"),
    authorEmail: text("author_email"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    postIdx: index("blog_post_revisions_post_idx").on(t.postId, t.createdAt),
  }),
);

export type BlogPostRevision = typeof blogPostRevisionsTable.$inferSelect;
export type NewBlogPostRevision = typeof blogPostRevisionsTable.$inferInsert;
