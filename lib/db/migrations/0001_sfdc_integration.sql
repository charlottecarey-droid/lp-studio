-- Add Salesforce integration columns to sales_accounts
ALTER TABLE sales_accounts
ADD COLUMN IF NOT EXISTS salesforce_id text UNIQUE,
ADD COLUMN IF NOT EXISTS sfdc_last_synced_at timestamptz;

-- Add Salesforce integration columns to sales_contacts
ALTER TABLE sales_contacts
ADD COLUMN IF NOT EXISTS salesforce_id text UNIQUE,
ADD COLUMN IF NOT EXISTS sfdc_last_synced_at timestamptz;

-- Create SFDC Connections table
CREATE TABLE IF NOT EXISTS sfdc_connections (
  id serial PRIMARY KEY,
  instance_url text NOT NULL,
  org_id text NOT NULL UNIQUE,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  token_expires_at timestamptz,
  status text NOT NULL DEFAULT 'connected',
  last_sync_at timestamptz,
  last_sync_error text,
  sync_enabled boolean NOT NULL DEFAULT true,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create SFDC Field Mappings table
CREATE TABLE IF NOT EXISTS sfdc_field_mappings (
  id serial PRIMARY KEY,
  connection_id integer NOT NULL REFERENCES sfdc_connections(id) ON DELETE CASCADE,
  sfdc_object text NOT NULL,
  sfdc_field text NOT NULL,
  local_table text NOT NULL,
  local_field text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  transform_fn text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create SFDC Sync Log table
CREATE TABLE IF NOT EXISTS sfdc_sync_log (
  id serial PRIMARY KEY,
  connection_id integer NOT NULL REFERENCES sfdc_connections(id) ON DELETE CASCADE,
  sync_type text NOT NULL,
  sfdc_object text NOT NULL,
  records_processed integer DEFAULT 0,
  records_created integer DEFAULT 0,
  records_updated integer DEFAULT 0,
  records_skipped integer DEFAULT 0,
  status text NOT NULL DEFAULT 'running',
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- Create SFDC Leads table
CREATE TABLE IF NOT EXISTS sfdc_leads (
  id serial PRIMARY KEY,
  salesforce_id text NOT NULL UNIQUE,
  first_name text,
  last_name text NOT NULL,
  email text,
  company text,
  title text,
  phone text,
  status text,
  lead_source text,
  industry text,
  rating text,
  converted_account_id integer REFERENCES sales_accounts(id),
  converted_contact_id integer REFERENCES sales_contacts(id),
  metadata jsonb DEFAULT '{}',
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create SFDC Opportunities table
CREATE TABLE IF NOT EXISTS sfdc_opportunities (
  id serial PRIMARY KEY,
  salesforce_id text NOT NULL UNIQUE,
  account_id integer REFERENCES sales_accounts(id),
  name text NOT NULL,
  amount text,
  stage_name text,
  probability integer,
  close_date timestamptz,
  type text,
  owner_id text,
  owner_name text,
  is_closed boolean DEFAULT false,
  is_won boolean DEFAULT false,
  metadata jsonb DEFAULT '{}',
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_sales_accounts_salesforce_id ON sales_accounts(salesforce_id);
CREATE INDEX IF NOT EXISTS idx_sales_contacts_salesforce_id ON sales_contacts(salesforce_id);
CREATE INDEX IF NOT EXISTS idx_sfdc_connections_org_id ON sfdc_connections(org_id);
CREATE INDEX IF NOT EXISTS idx_sfdc_field_mappings_connection_id ON sfdc_field_mappings(connection_id);
CREATE INDEX IF NOT EXISTS idx_sfdc_sync_log_connection_id ON sfdc_sync_log(connection_id);
CREATE INDEX IF NOT EXISTS idx_sfdc_leads_salesforce_id ON sfdc_leads(salesforce_id);
CREATE INDEX IF NOT EXISTS idx_sfdc_opportunities_salesforce_id ON sfdc_opportunities(salesforce_id);
CREATE INDEX IF NOT EXISTS idx_sfdc_opportunities_account_id ON sfdc_opportunities(account_id);
