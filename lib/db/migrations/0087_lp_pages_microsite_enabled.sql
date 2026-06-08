-- Task #1219 — create-microsite dropdown gating.
-- Tri-state per-template flag controlling whether a template appears in the
-- NewMicrositeModal dropdown:
--   NULL  = auto — fall back to the computed compatibility default.
--   true  = admin force-enabled.
--   false = admin force-disabled.
-- A marker-gated backfill in migrate.ts sets this for existing template rows
-- using the shared getMicrositeTemplateCompatibility() helper.
ALTER TABLE lp_pages ADD COLUMN IF NOT EXISTS microsite_enabled boolean;
