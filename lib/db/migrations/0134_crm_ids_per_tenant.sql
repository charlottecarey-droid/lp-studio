-- Scope the Marketo/HubSpot id uniqueness to the tenant (Aug 2026).
--
-- Migration 0133 fixed `salesforce_id` on sales_accounts/sales_contacts. The
-- two sibling columns added alongside it — `sales_contacts.marketo_lead_id`
-- and `sales_contacts.hubspot_contact_id` — carry the identical defect: a
-- column-level `.unique()` with no tenant_id, so one Marketo lead (or HubSpot
-- contact) can exist in exactly one workspace platform-wide.
--
-- Why it matters now: importing the members of a Marketo static list writes
-- marketo_lead_id on every contact it creates. Those inserts use
-- ON CONFLICT DO NOTHING, so a collision doesn't error — the row is silently
-- dropped and the run reports a smaller "created" count with no explanation.
-- Two workspaces pointed at overlapping Marketo data would each see a partial,
-- inexplicable import.
--
-- Same mechanics as 0133: drizzle's `.unique()` emits a CONSTRAINT, and
-- Postgres refuses DROP INDEX on a constraint-backed index, so drop the
-- constraint first and keep DROP INDEX as a fallback. Widening a uniqueness
-- rule can never fail on existing data. The partial predicate only keeps NULLs
-- out of the index — Postgres already treats them as non-conflicting.

ALTER TABLE "sales_contacts" DROP CONSTRAINT IF EXISTS "sales_contacts_marketo_lead_id_key";
ALTER TABLE "sales_contacts" DROP CONSTRAINT IF EXISTS "sales_contacts_hubspot_contact_id_key";

DROP INDEX IF EXISTS "sales_contacts_marketo_lead_id_key";
DROP INDEX IF EXISTS "sales_contacts_hubspot_contact_id_key";

CREATE UNIQUE INDEX IF NOT EXISTS "sales_contacts_tenant_marketo_lead_id_key"
  ON "sales_contacts" ("tenant_id", "marketo_lead_id")
  WHERE "marketo_lead_id" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "sales_contacts_tenant_hubspot_contact_id_key"
  ON "sales_contacts" ("tenant_id", "hubspot_contact_id")
  WHERE "hubspot_contact_id" IS NOT NULL;
