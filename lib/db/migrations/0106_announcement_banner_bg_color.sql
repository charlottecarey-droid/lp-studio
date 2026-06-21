-- Add a superadmin-editable background color for the marketing homepage
-- announcement banner. Defaults to the on-brand ink color (#1A1815) so existing
-- rows keep their current look. Idempotent — safe to re-run.

ALTER TABLE "marketing_announcement_banner"
  ADD COLUMN IF NOT EXISTS "bg_color" text NOT NULL DEFAULT '#1A1815';
