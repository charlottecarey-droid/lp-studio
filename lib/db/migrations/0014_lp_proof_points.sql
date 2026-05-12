-- Task #256 — first-class proof-point library, separate from per-segment stats.
-- Tenants can curate one approved pool of dated, sourced stats and reuse them
-- across pages and segments instead of re-typing the same number everywhere.
CREATE TABLE IF NOT EXISTS lp_proof_points (
  id              serial PRIMARY KEY,
  tenant_id       integer NOT NULL,
  value           text NOT NULL DEFAULT '',
  label           text NOT NULL DEFAULT '',
  source_url      text NOT NULL DEFAULT '',
  as_of_date      date,
  approved_for_ai boolean NOT NULL DEFAULT true,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lp_proof_points_tenant_idx ON lp_proof_points (tenant_id);
