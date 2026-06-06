-- Heal sfdc_leads.industry / sfdc_leads.rating drift.
--
-- These two nullable text columns are declared in @workspace/db
-- (lib/db/src/schema/sfdcIntegration.ts) and were originally part of the
-- CREATE TABLE in 0001_sfdc_integration.sql. On databases where sfdc_leads
-- already existed when 0001 ran (its CREATE TABLE is IF NOT EXISTS, so the
-- columns were never back-filled) the two columns are missing, which the
-- schema-drift guard (Task #1064) catches. A CREATE TABLE never adds columns
-- to an existing table, so the fix is a dedicated, idempotent ADD COLUMN that
-- is a no-op where the columns already exist and a heal where they don't.
ALTER TABLE sfdc_leads ADD COLUMN IF NOT EXISTS industry text;
ALTER TABLE sfdc_leads ADD COLUMN IF NOT EXISTS rating text;
