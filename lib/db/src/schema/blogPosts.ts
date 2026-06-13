import {
  pgTable,
  serial,
  text,
  integer,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
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
 * BODY FORMAT: markdown stored as TEXT. It is rendered on the FRONTEND with a
 * small, dependency-free sanitizing markdown renderer (see
 * artifacts/lp-studio/src/marketing/lib/markdown.ts). Markdown keeps authoring
 * simple in a textarea, keeps the stored content human-diffable, and the FE
 * renderer escapes raw HTML except for an allowlisted set of safe tags/attrs
 * (notably inline <svg> infographics and <img>) so authored infographics +
 * images render responsively without opening an XSS hole.
 *
 *   slug             — URL slug (unique). Auto-derived from title on save with
 *                      collision handling (-2, -3, …).
 *   title            — H1 / card title.
 *   excerpt          — short subtitle / dek shown on cards + used as the meta
 *                      description fallback.
 *   body             — markdown source (see BODY FORMAT above).
 *   coverImageUrl    — hero/card image (absolute or /api/storage relative).
 *   authorName       — byline.
 *   tags             — jsonb array of strings for filtering + the kicker.
 *   status           — 'draft' | 'published'. Public endpoints return ONLY
 *                      'published'; superadmin sees both.
 *   seoTitle         — <title> override (falls back to title).
 *   seoDescription   — meta description override (falls back to excerpt).
 *   ogImageUrl       — social share image override (falls back to coverImageUrl).
 *   readingTimeMin   — computed on save from the body word count.
 *   publishedAt      — set when first published; drives ordering + JSON-LD
 *                      datePublished + sitemap lastmod.
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
    readingTimeMin: integer("reading_time_min").notNull().default(1),
    publishedAt: timestamp("published_at", { withTimezone: true }),
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
  }),
);

export type BlogPost = typeof blogPostsTable.$inferSelect;
export type NewBlogPost = typeof blogPostsTable.$inferInsert;
