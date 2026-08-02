-- Platform-wide outreach draft copy — superadmin-editable config.
--
-- Single-row table (mirrors marketing_announcement_banner / marketing_homepage_og):
-- CREATE IF NOT EXISTS + seed only when empty, so re-running never wipes an
-- operator's edits.
--
-- This is the DEFAULT-OF-THE-DEFAULT for the draft a rep opens from
-- Pages → Copy email preview. Precedence at render time:
--   tenant (lp_brand_settings.salesConsole.outreach*)  →  this row  →  the
--   built-in constants in lp-studio/src/lib/email-preview.ts.
-- So editing this only moves tenants who left their own fields blank.
--
-- Seeded with the built-in wording so the cascade is a no-op on first deploy.

CREATE TABLE IF NOT EXISTS "platform_outreach_defaults" (
  "id" integer PRIMARY KEY DEFAULT 1,
  "subject" text NOT NULL DEFAULT '',
  "intro" text NOT NULL DEFAULT '',
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "platform_outreach_defaults_single_row" CHECK ("id" = 1)
);

INSERT INTO "platform_outreach_defaults" ("id", "subject", "intro")
SELECT
  1,
  '{{page_title}}',
  'Hey {{first_name}},

I put together a page just for you:'
WHERE NOT EXISTS (SELECT 1 FROM "platform_outreach_defaults");
