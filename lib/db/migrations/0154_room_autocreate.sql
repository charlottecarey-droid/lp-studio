-- Partner rooms created automatically: a workspace points at a sheet tab that
-- lists signed accounts (a Salesforce report, e.g. "Accounts with MSAs
-- Signed"); each account that appears there after the first read gets a draft
-- room. lp_room_autocreate_accounts remembers every account seen, so a room
-- is made once per account and never for the accounts already on the list
-- when the sheet was connected.
CREATE TABLE IF NOT EXISTS lp_room_autocreate (
  tenant_id integer PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  sheet_id text,
  sheet_tab text,
  synced_at timestamptz,
  sync_note text,
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS lp_room_autocreate_accounts (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL,
  account_key text NOT NULL,
  account_name text NOT NULL,
  signed_date text,
  owner text,
  page_id integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS lp_room_autocreate_accounts_tenant_key_uniq ON lp_room_autocreate_accounts (tenant_id, account_key);
-- The account's Salesforce id (when the tab has an id column) and the tab of
-- the same workbook that lists every account's locations: a new room reads
-- its practices from there, filtered to this account.
ALTER TABLE lp_room_autocreate ADD COLUMN IF NOT EXISTS practices_tab text;
ALTER TABLE lp_room_autocreate_accounts ADD COLUMN IF NOT EXISTS sfdc_account_id text;
