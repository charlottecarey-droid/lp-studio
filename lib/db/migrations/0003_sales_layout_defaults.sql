-- Layout defaults for one-pager templates and other configurable UI
CREATE TABLE IF NOT EXISTS sales_layout_defaults (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL,
  template_key text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Each (tenant, key) pair is unique so upserts replace existing values
CREATE UNIQUE INDEX IF NOT EXISTS sales_layout_defaults_tenant_key_idx
  ON sales_layout_defaults (tenant_id, template_key);
