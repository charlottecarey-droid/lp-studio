-- Per-workspace "featured" templates.
--
-- Records which templates a workspace has starred to feature for itself. A
-- featured template is surfaced prominently in the Template Marketplace
-- ("Featured" group) and offered as a starting point in the create-page modal.
--
-- This is PER-TENANT curation, distinct from the platform-wide premium_rank
-- ordering and from featured_homepage_templates (the superadmin-managed
-- marketing-homepage list). Each workspace controls its own featured set.
--
-- One row per (tenant, template); the star toggle inserts and the un-star
-- deletes. template_id FKs to lp_pages.id ON DELETE CASCADE so featured rows
-- are cleaned up automatically when a template page is deleted.
CREATE TABLE IF NOT EXISTS lp_tenant_featured_templates (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL,
  template_id integer NOT NULL REFERENCES lp_pages(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS lp_tenant_featured_templates_tenant_template_idx
  ON lp_tenant_featured_templates (tenant_id, template_id);

CREATE INDEX IF NOT EXISTS lp_tenant_featured_templates_tenant_idx
  ON lp_tenant_featured_templates (tenant_id);
