-- Per-page OG card overrides + email-embed image source (Aug 2026).
-- og_card_headline/subheadline/background: NULL = auto-derived from page content.
-- email_embed_source: 'card' (designed card, default) | 'og' (explicit og_image).
ALTER TABLE "lp_pages" ADD COLUMN IF NOT EXISTS "og_card_headline" text;
ALTER TABLE "lp_pages" ADD COLUMN IF NOT EXISTS "og_card_subheadline" text;
ALTER TABLE "lp_pages" ADD COLUMN IF NOT EXISTS "og_card_background" text;
ALTER TABLE "lp_pages" ADD COLUMN IF NOT EXISTS "email_embed_source" text NOT NULL DEFAULT 'card';
