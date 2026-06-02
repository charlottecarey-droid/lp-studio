-- Sales contact deletion: converted-lead back-reference must survive (task #786)
--
-- Why
-- ───
-- Deleting a sales_contacts row 500s with a Postgres FK violation when the
-- contact was ever the conversion target of an SFDC lead. sfdc_leads.
-- converted_contact_id was created in 0001 as
--   converted_contact_id integer REFERENCES sales_contacts(id)
-- with NO ON DELETE clause, so it defaults to RESTRICT/NO ACTION in prod. Its
-- sibling converted_account_id was healed to ON DELETE SET NULL by 0066, but
-- converted_contact_id was left behind — and it isn't even declared in the
-- drizzle schema, so the landmine is invisible at the source level. This is the
-- last remaining RESTRICT FK in the sales/sfdc schema; every other FK is
-- already CASCADE (owned children) or SET NULL (historical/reporting rows).
--
-- A converted lead's contact link is historical/reporting data that should
-- outlive the contact, so the FK becomes ON DELETE SET NULL (mirroring
-- converted_account_id in 0066).
--
-- Drift note: some DBs created sfdc_leads via an early push BEFORE the
-- column-defining migration, so converted_contact_id may be missing entirely
-- (0001's CREATE TABLE IF NOT EXISTS was then a no-op and never added it). ADD
-- COLUMN IF NOT EXISTS the nullable-integer column first so the FK can always be
-- (re)created; it is a no-op where the column already exists.
--
-- Drop both the Postgres-default (`_fkey`) and Drizzle-style
-- (`_<reftable>_<refcol>_fk`) constraint names defensively so this migration is
-- idempotent across environments, then re-add with ON DELETE SET NULL.

ALTER TABLE sfdc_leads
  ADD COLUMN IF NOT EXISTS converted_contact_id integer;
ALTER TABLE sfdc_leads
  DROP CONSTRAINT IF EXISTS sfdc_leads_converted_contact_id_fkey;
ALTER TABLE sfdc_leads
  DROP CONSTRAINT IF EXISTS sfdc_leads_converted_contact_id_sales_contacts_id_fk;
ALTER TABLE sfdc_leads
  ADD CONSTRAINT sfdc_leads_converted_contact_id_fkey
  FOREIGN KEY (converted_contact_id) REFERENCES sales_contacts(id)
  ON DELETE SET NULL;
