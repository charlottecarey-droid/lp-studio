-- Auto-sync a RainFocus catalog.
--
-- 1. Credentials + schedule on the event, so a sync can run unattended. The
--    widget apiToken is public by design (it ships in client-side HTML), but
--    it's still config: the API layer redacts it on read.
ALTER TABLE sales_events
  ADD COLUMN IF NOT EXISTS rainfocus_config jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2. Sessions that DISAPPEAR from the catalog are marked, never deleted — a
--    published agenda may already reference one, and silently dropping it would
--    change a page a customer has been sent. `catalog_status` is 'active' or
--    'missing'; `missing_since` records when we first stopped seeing it.
ALTER TABLE sales_event_sessions
  ADD COLUMN IF NOT EXISTS catalog_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS missing_since timestamptz;

CREATE INDEX IF NOT EXISTS sales_event_sessions_catalog_status_idx
  ON sales_event_sessions (event_id, catalog_status);
