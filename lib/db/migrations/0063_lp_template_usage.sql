-- Per-workspace template usage tracking (Task #753).
--
-- Records, per (tenant, template), when someone in the workspace last cloned
-- ("used") a template. Drives the "Recently Used" sort in both the Marketing
-- and Sales template libraries. Templates with no row here have never been
-- used by the workspace and sort to the bottom.
--
-- One row per (tenant, template); each clone upserts and bumps last_used_at.
-- template_id FKs to lp_pages.id ON DELETE CASCADE so usage rows are cleaned
-- up automatically when a template page is deleted.
CREATE TABLE IF NOT EXISTS lp_template_usage (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL,
  template_id integer NOT NULL REFERENCES lp_pages(id) ON DELETE CASCADE,
  last_used_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS lp_template_usage_tenant_template_idx
  ON lp_template_usage (tenant_id, template_id);

CREATE INDEX IF NOT EXISTS lp_template_usage_tenant_idx
  ON lp_template_usage (tenant_id);
