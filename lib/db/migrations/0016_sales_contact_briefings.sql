-- Per-contact AI call-prep briefs. Until now /api/sales/person-brief
-- generated a markdown brief on demand inside DraftEmailModal and threw
-- the result away as soon as the modal closed; reps had no way to revisit
-- yesterday's research and we burned a fresh OpenAI call on every email
-- draft. This table persists one brief per (tenant, contact) so the
-- contact-detail page can surface it without regeneration.
--
-- briefText is the raw LLM markdown — see person-brief.ts. Storing text
-- (not JSONB) keeps the prompt free to evolve without a schema migration
-- every time the section headers change.
CREATE TABLE IF NOT EXISTS sales_contact_briefings (
  id          serial PRIMARY KEY,
  tenant_id   integer NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id  integer NOT NULL REFERENCES sales_contacts(id) ON DELETE CASCADE,
  brief_text  text NOT NULL DEFAULT '',
  status      text NOT NULL DEFAULT 'complete',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX        IF NOT EXISTS idx_sales_contact_briefings_tenant_id           ON sales_contact_briefings (tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_contact_briefings_tenant_contact       ON sales_contact_briefings (tenant_id, contact_id);
