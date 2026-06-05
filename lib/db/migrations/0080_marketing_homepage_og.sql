-- Marketing homepage share card (Open Graph) — superadmin-editable config.
--
-- Moves the previously-hardcoded marketing homepage OG title/description/image
-- (from artifacts/lp-studio/src/marketing/pages/home.tsx) into a single-row,
-- superadmin-editable table so the team gets the same share-card editing
-- affordances (live preview, char-count guidance, dimension warning + resize)
-- the tenant landing pages already have. Mirrors the
-- `featured_homepage_templates` pattern: CREATE IF NOT EXISTS + seed the
-- current built-in defaults only when the table is empty, so it is idempotent
-- and never wipes an operator's edits on re-run.

CREATE TABLE IF NOT EXISTS "marketing_homepage_og" (
  "id" integer PRIMARY KEY DEFAULT 1,
  "og_title" text NOT NULL DEFAULT '',
  "og_description" text NOT NULL DEFAULT '',
  "og_image_url" text NOT NULL DEFAULT '',
  "og_image_width" integer,
  "og_image_height" integer,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "marketing_homepage_og_single_row" CHECK ("id" = 1)
);

INSERT INTO "marketing_homepage_og"
  ("id", "og_title", "og_description", "og_image_url", "og_image_width", "og_image_height")
SELECT
  1,
  'LP Studio — The AI Revenue Workspace for One-Team GTM',
  'Generate on-brand pages, personalize for every account, and know exactly who''s reading them. The AI revenue workspace for one-team GTM.',
  'https://lpstudio.ai/opengraph.jpg',
  1200,
  630
WHERE NOT EXISTS (SELECT 1 FROM "marketing_homepage_og");
