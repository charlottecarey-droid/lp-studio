-- Per-tenant overrides of a GLOBAL (shared) template's create-microsite-dropdown
-- settings (enable/hide + rename). Owned templates keep their state on lp_pages;
-- this table holds a tenant's edits to shared global flagship/business-case
-- templates so the shared row is never mutated and edits never leak across
-- tenants. Idempotent: safe to run on every DB.
CREATE TABLE IF NOT EXISTS lp_microsite_template_overrides (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  template_id integer NOT NULL REFERENCES lp_pages(id) ON DELETE CASCADE,
  enabled boolean,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS lp_microsite_template_overrides_tenant_template_unique
  ON lp_microsite_template_overrides (tenant_id, template_id);

CREATE INDEX IF NOT EXISTS lp_microsite_template_overrides_tenant_idx
  ON lp_microsite_template_overrides (tenant_id);
