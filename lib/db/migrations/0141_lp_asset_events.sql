-- Content Hub asset engagement (Oct 2026).
--
-- The hub-library / hub-featured blocks beacon one row per visitor action on
-- a resource (view in the in-page viewer, open in a new tab, download) so the
-- page-detail analytics can answer "how much is each asset being viewed?".
--
-- No FK to lp_pages: engagement history must outlive a deleted page. Tenant
-- is stamped server-side from the page row (never trusted from the beacon).
CREATE TABLE IF NOT EXISTS lp_asset_events (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL,
  page_id integer NOT NULL,
  block_id text,
  asset_key text NOT NULL,
  asset_title text,
  asset_kind text NOT NULL,
  action text NOT NULL,
  session_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- The per-page drill-down filters by page and a date window.
CREATE INDEX IF NOT EXISTS lp_asset_events_page_created_idx
  ON lp_asset_events (page_id, created_at);
