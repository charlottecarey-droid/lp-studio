-- Tenant-level default Open Graph / social share-card metadata (Task #967).
--
-- These three columns are the TENANT DEFAULT layer of the per-page OG cascade
-- resolved by api-server `resolvePageOG(pageId)`:
--   per-page field → tenant default → derived from page content → system fallback
--
--   * default_og_title       — fallback social/share title for every published
--                              page that has no per-page metaTitle. Supports the
--                              {{page_title}} token, substituted with the page's
--                              own title at resolve time.
--   * default_og_description — fallback share description.
--   * default_og_image_url   — fallback 1200×630 share-card image URL. Must be a
--                              publicly fetchable absolute URL (social scrapers
--                              cannot authenticate).
--
-- All nullable with no default → existing tenants keep today's behaviour (the
-- cascade falls straight through to page content / system fallback) until an
-- admin sets a default from brand settings.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS default_og_title text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS default_og_description text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS default_og_image_url text;
