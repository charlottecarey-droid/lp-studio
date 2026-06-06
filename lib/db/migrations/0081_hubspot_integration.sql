-- HubSpot — dedicated bidirectional HubSpot CRM integration.
--
-- Mirrors the Marketo Phase 2 integration (0077) but authenticates with a
-- per-tenant PRIVATE APP access token (a long-lived bearer token the customer
-- pastes in). Like Marketo's client-credentials there is no user-facing OAuth
-- redirect; unlike Marketo there is no refresh token / token expiry, so the
-- connections table has no token_expires_at column. Every table carries a
-- tenant_id NOT NULL FK (ON DELETE CASCADE) + index from the start — there is
-- no cross-tenant fallback. Adds hubspot_contact_id / hubspot_last_synced_at to
-- sales_contacts, parallel to salesforce_id / marketo_lead_id.
--
-- Idempotent throughout (CREATE TABLE / ADD COLUMN / CREATE INDEX IF NOT
-- EXISTS) so it is safe to re-run via the migrate.ts self-heal step.

-- HubSpot contact linkage on sales_contacts (parallel to salesforce_id / marketo_lead_id)
ALTER TABLE sales_contacts
  ADD COLUMN IF NOT EXISTS hubspot_contact_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS hubspot_last_synced_at timestamptz;

-- HubSpot Connections — one row per (tenant, portal)
CREATE TABLE IF NOT EXISTS hubspot_connections (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  portal_id text NOT NULL,
  access_token text NOT NULL,
  status text NOT NULL DEFAULT 'connected',
  last_sync_at timestamptz,
  last_sync_error text,
  sync_enabled boolean NOT NULL DEFAULT true,
  import_unlinked_leads boolean NOT NULL DEFAULT false,
  enroll_list_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hubspot_connections_tenant_id ON hubspot_connections (tenant_id);
DO $$ BEGIN
  ALTER TABLE hubspot_connections ADD CONSTRAINT uq_hubspot_connections_tenant_portal UNIQUE (tenant_id, portal_id);
EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; END $$;

-- HubSpot Field Mappings
CREATE TABLE IF NOT EXISTS hubspot_field_mappings (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connection_id integer NOT NULL REFERENCES hubspot_connections(id) ON DELETE CASCADE,
  hubspot_property text NOT NULL,
  local_table text NOT NULL,
  local_field text NOT NULL,
  direction text NOT NULL DEFAULT 'both',
  is_active boolean NOT NULL DEFAULT true,
  transform_fn text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hubspot_field_mappings_tenant_id ON hubspot_field_mappings (tenant_id);
CREATE INDEX IF NOT EXISTS idx_hubspot_field_mappings_connection_id ON hubspot_field_mappings (connection_id);

-- HubSpot Sync Log
CREATE TABLE IF NOT EXISTS hubspot_sync_log (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connection_id integer NOT NULL REFERENCES hubspot_connections(id) ON DELETE CASCADE,
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
CREATE INDEX IF NOT EXISTS idx_hubspot_sync_log_tenant_id ON hubspot_sync_log (tenant_id);
CREATE INDEX IF NOT EXISTS idx_hubspot_sync_log_connection_id ON hubspot_sync_log (connection_id);

-- HubSpot Lists (cached)
CREATE TABLE IF NOT EXISTS hubspot_lists (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connection_id integer NOT NULL REFERENCES hubspot_connections(id) ON DELETE CASCADE,
  hubspot_id text NOT NULL,
  list_type text NOT NULL,
  name text NOT NULL,
  description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hubspot_lists_tenant_id ON hubspot_lists (tenant_id);
CREATE INDEX IF NOT EXISTS idx_hubspot_lists_connection_id ON hubspot_lists (connection_id);
DO $$ BEGIN
  ALTER TABLE hubspot_lists ADD CONSTRAINT uq_hubspot_lists_connection_hubspot_id UNIQUE (connection_id, hubspot_id, list_type);
EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; END $$;

-- HubSpot Activities Pushed — idempotency ledger for outbound writes
CREATE TABLE IF NOT EXISTS hubspot_activities_pushed (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connection_id integer NOT NULL REFERENCES hubspot_connections(id) ON DELETE CASCADE,
  local_event_id text NOT NULL,
  event_type text NOT NULL,
  hubspot_activity_id text,
  pushed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hubspot_activities_pushed_tenant_id ON hubspot_activities_pushed (tenant_id);
CREATE INDEX IF NOT EXISTS idx_hubspot_activities_pushed_connection_id ON hubspot_activities_pushed (connection_id);
DO $$ BEGIN
  ALTER TABLE hubspot_activities_pushed ADD CONSTRAINT uq_hubspot_activities_pushed_connection_event UNIQUE (connection_id, local_event_id);
EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; END $$;
