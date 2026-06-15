-- Marketing homepage announcement banner — superadmin-editable config.
--
-- A single-row table that drives the slim promo bar at the top of the marketing
-- apex homepage (lpstudio.ai/). Mirrors the `marketing_homepage_og` pattern:
-- CREATE IF NOT EXISTS + seed the initial content only when the table is empty,
-- so it is idempotent and never wipes an operator's edits on re-run.
--
-- Seeded enabled = true with the launch content (the AI Landing Page
-- Personalization field guide) so the bar goes live on first deploy; the team
-- can edit the copy, swap the link, or switch it off from Superadmin.

CREATE TABLE IF NOT EXISTS "marketing_announcement_banner" (
  "id" integer PRIMARY KEY DEFAULT 1,
  "enabled" boolean NOT NULL DEFAULT false,
  "text" text NOT NULL DEFAULT '',
  "link_url" text NOT NULL DEFAULT '',
  "cta_label" text NOT NULL DEFAULT '',
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "marketing_announcement_banner_single_row" CHECK ("id" = 1)
);

INSERT INTO "marketing_announcement_banner"
  ("id", "enabled", "text", "link_url", "cta_label")
SELECT
  1,
  true,
  'New — The Ultimate Guide to AI Landing Page Personalization',
  'https://test-lp.lpstudio.ai/api/storage/objects/uploads/523fb7ba-2274-4af2-8e49-71cecda55538',
  'Read the guide'
WHERE NOT EXISTS (SELECT 1 FROM "marketing_announcement_banner");
