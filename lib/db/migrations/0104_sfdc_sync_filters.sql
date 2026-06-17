-- Per-object inbound Salesforce sync filters (Task #1356).
--
-- Adds a `sync_filters` jsonb column to sfdc_connections. When a per-object
-- filter is set, that object's manual sync only pulls the matching subset from
-- Salesforce instead of ALL records (still capped at 10,000). An empty object
-- ({}) — the default — means "sync everything", preserving prior behaviour.
--
-- Additive + idempotent so it is safe on the shared production database.
ALTER TABLE sfdc_connections
  ADD COLUMN IF NOT EXISTS sync_filters jsonb NOT NULL DEFAULT '{}'::jsonb;
