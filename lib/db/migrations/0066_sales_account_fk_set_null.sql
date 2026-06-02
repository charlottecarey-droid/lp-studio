-- Sales account deletion: historical/reporting child rows must survive (task #781)
--
-- Why
-- ───
-- Deleting a sales_accounts row 500s with a Postgres FK violation when the
-- account has ever had an email campaign, an SFDC opportunity, or a converted
-- SFDC lead. Three FKs into sales_accounts default to RESTRICT/NO ACTION in
-- prod and block the delete:
--   1. sales_email_campaigns.account_id   — 0008 already set ON DELETE SET NULL
--      in the schema, but 0008 is journaled below the prod DB's migration
--      high-water mark, so drizzle silently skipped it forever; the live
--      constraint still has no ON DELETE action.
--   2. sfdc_opportunities.account_id      — never had an ON DELETE clause.
--   3. sfdc_leads.converted_account_id    — never had an ON DELETE clause and
--      the FK isn't even declared in the drizzle schema (plain integer).
-- These are historical/reporting rows that should outlive the account, so all
-- three become ON DELETE SET NULL.
--
-- Drift note: some DBs created sfdc_leads / sfdc_opportunities /
-- sales_email_campaigns via an early push BEFORE the column-defining migration,
-- so the relevant column may be missing entirely (0001's CREATE TABLE IF NOT
-- EXISTS was then a no-op and never added it). ADD COLUMN IF NOT EXISTS the
-- nullable-integer columns first so the FK can always be (re)created; it is a
-- no-op where the columns already exist.
--
-- Drop both the Postgres-default (`_fkey`) and Drizzle-style
-- (`_<reftable>_<refcol>_fk`) constraint names defensively so this migration is
-- idempotent across environments, then re-add with ON DELETE SET NULL.

-- 1. sales_email_campaigns.account_id
ALTER TABLE sales_email_campaigns
  ADD COLUMN IF NOT EXISTS account_id integer;
ALTER TABLE sales_email_campaigns
  DROP CONSTRAINT IF EXISTS sales_email_campaigns_account_id_fkey;
ALTER TABLE sales_email_campaigns
  DROP CONSTRAINT IF EXISTS sales_email_campaigns_account_id_sales_accounts_id_fk;
ALTER TABLE sales_email_campaigns
  ADD CONSTRAINT sales_email_campaigns_account_id_fkey
  FOREIGN KEY (account_id) REFERENCES sales_accounts(id)
  ON DELETE SET NULL;

-- 2. sfdc_opportunities.account_id
ALTER TABLE sfdc_opportunities
  ADD COLUMN IF NOT EXISTS account_id integer;
ALTER TABLE sfdc_opportunities
  DROP CONSTRAINT IF EXISTS sfdc_opportunities_account_id_fkey;
ALTER TABLE sfdc_opportunities
  DROP CONSTRAINT IF EXISTS sfdc_opportunities_account_id_sales_accounts_id_fk;
ALTER TABLE sfdc_opportunities
  ADD CONSTRAINT sfdc_opportunities_account_id_fkey
  FOREIGN KEY (account_id) REFERENCES sales_accounts(id)
  ON DELETE SET NULL;

-- 3. sfdc_leads.converted_account_id
ALTER TABLE sfdc_leads
  ADD COLUMN IF NOT EXISTS converted_account_id integer;
ALTER TABLE sfdc_leads
  DROP CONSTRAINT IF EXISTS sfdc_leads_converted_account_id_fkey;
ALTER TABLE sfdc_leads
  DROP CONSTRAINT IF EXISTS sfdc_leads_converted_account_id_sales_accounts_id_fk;
ALTER TABLE sfdc_leads
  ADD CONSTRAINT sfdc_leads_converted_account_id_fkey
  FOREIGN KEY (converted_account_id) REFERENCES sales_accounts(id)
  ON DELETE SET NULL;
