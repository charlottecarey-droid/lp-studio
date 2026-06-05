-- Marketo Phase 2 — dedicated bidirectional Marketo integration (Task #943).
--
-- Replaces the Phase-1 outbound-only approach (credentials bolted onto the
-- generic lp_integrations provider row) with dedicated tables mirroring the
-- SFDC integration. Every table carries a tenant_id NOT NULL FK (ON DELETE
-- CASCADE) + index from the start — there is no cross-tenant fallback. Adds
-- marketo_lead_id / marketo_last_synced_at to sales_contacts, parallel to the
-- salesforce_id / sfdc_last_synced_at columns.
--
-- Idempotent throughout (CREATE TABLE / ADD COLUMN / CREATE INDEX IF NOT
-- EXISTS) so it is safe to re-run via the migrate.ts self-heal step.

-- Marketo contact linkage on sales_contacts (parallel to salesforce_id)
ALTER TABLE sales_contacts
  ADD COLUMN IF NOT EXISTS marketo_lead_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS marketo_last_synced_at timestamptz;

-- Marketo Connections — one row per (tenant, munchkin)
CREATE TABLE IF NOT EXISTS marketo_connections (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  munchkin_id text NOT NULL,
  rest_endpoint text NOT NULL,
  identity_endpoint text NOT NULL,
  client_id text NOT NULL,
  client_secret text NOT NULL,
  access_token text,
  token_expires_at timestamptz,
  status text NOT NULL DEFAULT 'connected',
  last_sync_at timestamptz,
  last_sync_error text,
  sync_enabled boolean NOT NULL DEFAULT true,
  import_unlinked_leads boolean NOT NULL DEFAULT false,
  enroll_list_id text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_marketo_connections_tenant_id ON marketo_connections (tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_marketo_connections_tenant_munchkin ON marketo_connections (tenant_id, munchkin_id);

-- Marketo Field Mappings
CREATE TABLE IF NOT EXISTS marketo_field_mappings (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connection_id integer NOT NULL REFERENCES marketo_connections(id) ON DELETE CASCADE,
  marketo_field text NOT NULL,
  local_table text NOT NULL,
  local_field text NOT NULL,
  direction text NOT NULL DEFAULT 'both',
  is_active boolean NOT NULL DEFAULT true,
  transform_fn text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_marketo_field_mappings_tenant_id ON marketo_field_mappings (tenant_id);
CREATE INDEX IF NOT EXISTS idx_marketo_field_mappings_connection_id ON marketo_field_mappings (connection_id);

-- Marketo Sync Log (with resumable lastCursor)
CREATE TABLE IF NOT EXISTS marketo_sync_log (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connection_id integer NOT NULL REFERENCES marketo_connections(id) ON DELETE CASCADE,
  sync_type text NOT NULL,
  object_type text NOT NULL,
  records_processed integer DEFAULT 0,
  records_created integer DEFAULT 0,
  records_updated integer DEFAULT 0,
  records_skipped integer DEFAULT 0,
  status text NOT NULL DEFAULT 'running',
  error_message text,
  last_cursor text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_marketo_sync_log_tenant_id ON marketo_sync_log (tenant_id);
CREATE INDEX IF NOT EXISTS idx_marketo_sync_log_connection_id ON marketo_sync_log (connection_id);

-- Marketo Lists (cached static lists / programs / smart lists)
CREATE TABLE IF NOT EXISTS marketo_lists (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connection_id integer NOT NULL REFERENCES marketo_connections(id) ON DELETE CASCADE,
  marketo_id text NOT NULL,
  list_type text NOT NULL,
  name text NOT NULL,
  description text,
  metadata jsonb DEFAULT '{}',
  fetched_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_marketo_lists_tenant_id ON marketo_lists (tenant_id);
CREATE INDEX IF NOT EXISTS idx_marketo_lists_connection_id ON marketo_lists (connection_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_marketo_lists_connection_marketo_id ON marketo_lists (connection_id, marketo_id, list_type);

-- Marketo Activities Pushed (outbound idempotency ledger)
CREATE TABLE IF NOT EXISTS marketo_activities_pushed (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connection_id integer NOT NULL REFERENCES marketo_connections(id) ON DELETE CASCADE,
  local_event_id text NOT NULL,
  event_type text NOT NULL,
  marketo_activity_id text,
  pushed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_marketo_activities_pushed_tenant_id ON marketo_activities_pushed (tenant_id);
CREATE INDEX IF NOT EXISTS idx_marketo_activities_pushed_connection_id ON marketo_activities_pushed (connection_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_marketo_activities_pushed_connection_event ON marketo_activities_pushed (connection_id, local_event_id);
