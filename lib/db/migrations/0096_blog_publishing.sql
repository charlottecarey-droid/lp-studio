-- June 2026 — LP Studio blog Phase 2 (publishing experience).
--
-- Additive only. Adds:
--   * blog_posts.scheduled_at      — when status='scheduled', the time the
--     blogPublishPoller sweep auto-flips the post to 'published'. NULL for
--     draft/published. status now allows 'scheduled' in addition to
--     'draft'|'published' (the column stays free-text; the app normalizes).
--   * blog_posts.og_focal_x/_y     — focal point (0–1, default 0.5) for the
--     OG/social-card crop. No derived image is produced; the renderer maps the
--     focal point to CSS object-position over a 1200×630 (1.91:1) frame.
--   * blog_post_revisions          — append-only version history (snapshot of
--     the editable field-set as jsonb), with bounded retention pruned in-app.
--
-- Everything is IF NOT EXISTS / ADD COLUMN IF NOT EXISTS, so it is safe to
-- re-run and pairs with the marker-gated self-heal in api-server migrate.ts
-- (blog_publishing_phase2). Public read endpoints still serve only
-- status='published' (scheduled posts never appear publicly until flipped).

ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS og_focal_x double precision NOT NULL DEFAULT 0.5;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS og_focal_y double precision NOT NULL DEFAULT 0.5;

CREATE INDEX IF NOT EXISTS blog_posts_status_scheduled_idx ON blog_posts (status, scheduled_at);

CREATE TABLE IF NOT EXISTS blog_post_revisions (
  id            serial PRIMARY KEY,
  post_id       integer NOT NULL,
  snapshot      jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason        text NOT NULL DEFAULT 'save',
  author_email  text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS blog_post_revisions_post_idx ON blog_post_revisions (post_id, created_at);
