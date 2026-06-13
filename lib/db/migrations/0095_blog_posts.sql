-- June 2026 — LP Studio's own first-party marketing blog (blog_posts).
--
-- SINGLE first-party blog, NOT per-tenant. This is platform marketing content
-- authored from /superadmin and rendered on the PUBLIC marketing apex
-- (lpstudio.ai/blog), built for SEO + GEO. Like featured_homepage_templates
-- and marketing_homepage_og, it is superadmin-owned site content, so there is
-- deliberately NO tenant_id column.
--
-- body is sanitized HTML stored as text (Phase 1 migration, June 2026 — was
-- markdown; the column keeps its name since HTML fits in text). It is
-- RE-sanitized on the frontend at render time (tag/attr allowlist + inline SVG
-- + allowlisted iframe embeds). Public endpoints serve only status =
-- 'published'. Legacy markdown rows are converted in place by a marker-gated,
-- fail-open heal in api-server migrate.ts (blog_posts_md_to_html_v1).
CREATE TABLE IF NOT EXISTS blog_posts (
  id                serial PRIMARY KEY,
  slug              text NOT NULL,
  title             text NOT NULL,
  excerpt           text NOT NULL DEFAULT '',
  body              text NOT NULL DEFAULT '',
  cover_image_url   text,
  author_name       text NOT NULL DEFAULT 'LP Studio',
  tags              jsonb NOT NULL DEFAULT '[]'::jsonb,
  status            text NOT NULL DEFAULT 'draft',
  seo_title         text,
  seo_description   text,
  og_image_url      text,
  reading_time_min  integer NOT NULL DEFAULT 1,
  published_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS blog_posts_slug_unique ON blog_posts (slug);
CREATE INDEX IF NOT EXISTS blog_posts_status_published_idx ON blog_posts (status, published_at);
