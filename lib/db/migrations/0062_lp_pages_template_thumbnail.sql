-- Template-gallery preview thumbnails (Task #736).
--
-- Templates are `lp_pages` rows with is_template = true; there is no separate
-- `templates` table. The gallery currently renders `og_image` (the social/share
-- card) as a card background, falling back to a gradient. We add a DEDICATED
-- thumbnail so gallery previews stay distinct from the OG image: the card
-- prefers thumbnail_url ?? og_image ?? gradient.
--
--   * thumbnail_url         — thum.io screenshot URL captured from /preview/:slug.
--                             NULL = never captured (or last capture failed) so
--                             the capture job retries it next run.
--   * thumbnail_captured_at — when the capture last succeeded; drives the
--                             ?v=<ts> cache-buster and the "Capturing preview…"
--                             shimmer for freshly-created templates.
--
-- Both nullable with no default → existing rows keep today's gradient/OG
-- behaviour until the one-time backfill (or the next publish/edit) populates
-- them.
ALTER TABLE lp_pages ADD COLUMN IF NOT EXISTS thumbnail_url text;
ALTER TABLE lp_pages ADD COLUMN IF NOT EXISTS thumbnail_captured_at timestamptz;
