-- Per-form GTM dataLayer push config.
--
-- Shape (when set):
--   { "enabled": boolean, "event": string, "formName": string }
--
-- NULL means "use the built-in default" — which is the EXACT payload the
-- SMB trios5 page on lp.meetdandy.com (global form 6) has fired since
-- this feature shipped: { enabled: true, event: "Marketo Form Submission",
-- formName: "Demo Form" }. Keeping the default in code (not seeded per
-- row) means every existing form across every tenant continues to push
-- the same payload it does today, and a future default change is a
-- one-line code edit instead of a migration.
ALTER TABLE lp_forms
  ADD COLUMN IF NOT EXISTS gtm_data_layer_config jsonb;
