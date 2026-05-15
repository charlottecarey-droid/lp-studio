-- Task #281 — attribute Marketo "ghost submit" failures to a specific page
-- and form. The tenant-wide failures count on the analytics page told admins
-- *that* leads were being silently dropped but not *which* page/form was
-- broken; without these columns the only way to bisect a CSP / Marketo
-- config regression was to manually open every published page.
--
-- Both columns are nullable (existing rows + non-form events like
-- impression / cta_click stay valid) and intentionally have no FK so a
-- deleted page/form does not orphan-delete historical telemetry.
ALTER TABLE lp_events ADD COLUMN IF NOT EXISTS page_id integer;
ALTER TABLE lp_events ADD COLUMN IF NOT EXISTS form_id integer;

-- Drill-down query in /lp/analytics/ghost-submits filters by event_type +
-- conversion_type then groups by (page_id, form_id), so a partial index
-- over the failure rows keeps it fast as ghost telemetry accumulates.
CREATE INDEX IF NOT EXISTS lp_events_ghost_submit_idx
  ON lp_events (conversion_type, created_at)
  WHERE event_type = 'conversion'
    AND conversion_type IN ('ghost_submit_attempted', 'ghost_submit_failed');
