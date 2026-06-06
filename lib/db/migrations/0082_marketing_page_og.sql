-- Marketing page share cards (Open Graph) — superadmin-editable config.
--
-- Generalises the single-row `marketing_homepage_og` table (Task #970) to the
-- rest of the key marketing routes (Task #997): /features, /pricing,
-- /for-marketing, /for-sales, /compare. Rows are keyed by a stable `page_key`.
--
-- Unlike the homepage table, this one is intentionally NOT seeded: an absent
-- row means "use the page's built-in defaults" (the values previously hardcoded
-- in each marketing page's usePageMeta call). CREATE IF NOT EXISTS keeps it
-- idempotent and never wipes an operator's edits on re-run.

CREATE TABLE IF NOT EXISTS "marketing_page_og" (
  "page_key" text PRIMARY KEY,
  "og_title" text NOT NULL DEFAULT '',
  "og_description" text NOT NULL DEFAULT '',
  "og_image_url" text NOT NULL DEFAULT '',
  "og_image_width" integer,
  "og_image_height" integer,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
