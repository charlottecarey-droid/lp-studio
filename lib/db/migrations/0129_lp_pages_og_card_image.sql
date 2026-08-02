-- Designed OG share card (Aug 2026). System-owned auto-generated card image,
-- kept separate from og_image (the user's explicit choice) so design-version
-- bumps can lazily regenerate cards without touching user uploads.
ALTER TABLE "lp_pages" ADD COLUMN IF NOT EXISTS "og_card_image" text;
ALTER TABLE "lp_pages" ADD COLUMN IF NOT EXISTS "og_card_version" integer;
