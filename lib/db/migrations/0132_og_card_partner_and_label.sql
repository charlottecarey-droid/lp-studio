-- Per-page embed-card controls (Aug 2026).
--
-- og_card_partner_logo: '' / NULL = auto-detect the partner mark from page
--   content (the historical behaviour), 'none' = never show one, any other
--   value = an explicit image URL. Auto-detection guesses from block content
--   and can pick the wrong mark on a page with several logos, so "none" is the
--   escape hatch.
-- og_card_link_label: caption on the link under the pasted card. NULL = the
--   built-in default; previously this was always the page title, which reads
--   like a filename in an email.
ALTER TABLE "lp_pages" ADD COLUMN IF NOT EXISTS "og_card_partner_logo" text;
ALTER TABLE "lp_pages" ADD COLUMN IF NOT EXISTS "og_card_link_label" text;
