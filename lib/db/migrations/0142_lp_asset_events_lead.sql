-- Content Hub asset engagement: gated-resource attribution + tenant-wide
-- aggregation (Oct 2026).
--
-- `lead_id` is stamped on an event when the visitor unlocked a gated resource
-- (the lead the gate form created), verified against the tenant server-side.
-- The tenant/date index serves the Analytics → Resources tab, which reads
-- every hub page of a tenant at once.
ALTER TABLE lp_asset_events ADD COLUMN IF NOT EXISTS lead_id integer;

CREATE INDEX IF NOT EXISTS lp_asset_events_tenant_created_idx
  ON lp_asset_events (tenant_id, created_at);
