-- Scope the Salesforce-ID uniqueness to the tenant (Aug 2026).
--
-- `sales_accounts.salesforce_id` and `sales_contacts.salesforce_id` carried a
-- GLOBAL uniqueness rule — no tenant_id, no partial predicate. Every other
-- uniqueness rule in this schema is per-tenant, so this was almost certainly an
-- oversight rather than intent, and it means one Salesforce record can exist in
-- exactly one workspace across the whole platform.
--
-- Consequence in the wild: importing the same Salesforce accounts/contacts into
-- a second workspace fails on every row. The importer's "already exists?" probe
-- IS tenant-scoped, so it finds nothing locally, attempts an INSERT, and hits
-- the global rule. Two workspaces covering overlapping Salesforce data (an
-- enterprise instance and an SMB instance of the same company) simply cannot
-- both hold it.
--
-- These are UNIQUE CONSTRAINTS, not bare indexes — drizzle's column-level
-- `.unique()` emits a constraint. Postgres refuses `DROP INDEX` on the index
-- backing a constraint ("...because constraint ... requires it"), and
-- `pg_indexes` lists constraint-backed indexes identically to standalone ones,
-- so inspecting that view alone will not tell you which shape you have. Drop
-- the constraint; the DROP INDEX lines below are a fallback for any environment
-- where it exists as a plain index instead.
--
-- Widening a uniqueness rule can never fail on existing data — every row that
-- was globally unique is trivially unique within its tenant too.
--
-- The partial predicate keeps NULLs out of the index. Postgres already treats
-- NULLs as non-conflicting, so this is purely to keep the index small; the
-- behaviour is unchanged.

ALTER TABLE "sales_accounts" DROP CONSTRAINT IF EXISTS "sales_accounts_salesforce_id_key";
ALTER TABLE "sales_contacts" DROP CONSTRAINT IF EXISTS "sales_contacts_salesforce_id_key";

DROP INDEX IF EXISTS "sales_accounts_salesforce_id_key";
DROP INDEX IF EXISTS "sales_contacts_salesforce_id_key";

CREATE UNIQUE INDEX IF NOT EXISTS "sales_accounts_tenant_salesforce_id_key"
  ON "sales_accounts" ("tenant_id", "salesforce_id")
  WHERE "salesforce_id" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "sales_contacts_tenant_salesforce_id_key"
  ON "sales_contacts" ("tenant_id", "salesforce_id")
  WHERE "salesforce_id" IS NOT NULL;
