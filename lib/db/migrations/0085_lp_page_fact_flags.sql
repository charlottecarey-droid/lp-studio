-- Task #1138 — Strict Facts simplified review flow.
--
-- 1) Per-page fact-flag table: every AI-generated fact that needs human review
--    before publish, with a small triage state machine. Scoped to one page so a
--    fact can be approved for that page alone without touching the global
--    proof-point library. Replaces the old ephemeral sessionStorage handoff.
CREATE TABLE IF NOT EXISTS lp_page_fact_flags (
  id                          serial PRIMARY KEY,
  tenant_id                   integer NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  page_id                     integer NOT NULL REFERENCES lp_pages(id) ON DELETE CASCADE,
  fact_kind                   text NOT NULL DEFAULT 'stat',
  normalized_form             text NOT NULL DEFAULT '',
  block_id                    text,
  block_type                  text,
  field_path                  text NOT NULL DEFAULT '',
  original_text               text NOT NULL DEFAULT '',
  triage_state                text NOT NULL DEFAULT 'pending',
  replacement_text            text,
  swapped_with_proof_point_id integer REFERENCES lp_proof_points(id) ON DELETE SET NULL,
  library_saved               boolean NOT NULL DEFAULT false,
  source                      text NOT NULL DEFAULT 'ai',
  attribution_name            text,
  attribution_title           text,
  attribution_company         text,
  resolved_at                 timestamptz,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lp_page_fact_flags_tenant_idx ON lp_page_fact_flags (tenant_id);
CREATE INDEX IF NOT EXISTS lp_page_fact_flags_page_idx ON lp_page_fact_flags (page_id);
CREATE INDEX IF NOT EXISTS lp_page_fact_flags_page_state_idx ON lp_page_fact_flags (page_id, triage_state);
CREATE INDEX IF NOT EXISTS lp_page_fact_flags_page_norm_idx ON lp_page_fact_flags (page_id, normalized_form);

-- 2) Proof points can now be reusable QUOTES (with attribution), not just stats,
--    so the Swap dropdown in the review modal can filter by fact kind. ADD COLUMN
--    IF NOT EXISTS so this is a no-op heal on DBs that already have the columns.
ALTER TABLE lp_proof_points ADD COLUMN IF NOT EXISTS fact_kind text NOT NULL DEFAULT 'stat';
ALTER TABLE lp_proof_points ADD COLUMN IF NOT EXISTS attribution_name text NOT NULL DEFAULT '';
ALTER TABLE lp_proof_points ADD COLUMN IF NOT EXISTS attribution_title text NOT NULL DEFAULT '';
ALTER TABLE lp_proof_points ADD COLUMN IF NOT EXISTS attribution_company text NOT NULL DEFAULT '';
ALTER TABLE lp_proof_points ADD COLUMN IF NOT EXISTS attribution_photo_url text NOT NULL DEFAULT '';
ALTER TABLE lp_proof_points ADD COLUMN IF NOT EXISTS consent_note text NOT NULL DEFAULT '';
