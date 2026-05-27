-- Per-URL cache for the LP Studio brand importer. We store the full
-- orchestrator payload (all six dimension results plus evidence pointers)
-- keyed by normalized URL so repeated onboarding clicks don't re-scrape
-- and don't burn LLM credits. 24h TTL is enforced at read time, not by
-- a job, so a manual refresh just writes a new row.
CREATE TABLE IF NOT EXISTS lp_brand_import_cache (
  url_key text PRIMARY KEY,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lp_brand_import_cache_created_at_idx
  ON lp_brand_import_cache (created_at);
