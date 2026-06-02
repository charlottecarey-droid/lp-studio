---
name: Sales account child-FK ON DELETE + missing-column drift
description: Why deleting a sales_accounts row 500s and how a forward FK migration must also self-heal a possibly-missing referenced column on drifted DBs.
---

# Sales account deletion FK drift

Deleting a `sales_accounts` row 500s ("Failed to delete account") with a
Postgres FK violation when the account has ever had an email campaign, an SFDC
opportunity, or a converted SFDC lead. Three child FKs into `sales_accounts`
must be `ON DELETE SET NULL` (historical/reporting rows outlive the account):
`sales_email_campaigns.account_id`, `sfdc_opportunities.account_id`,
`sfdc_leads.converted_account_id`.

**Rule:** changing an FK's ON DELETE on this codebase needs BOTH a forward
migration AND a drift-proof self-heal in `artifacts/api-server/src/migrate.ts`
(re-runs the .sql independent of drizzle's high-water-mark dedup, asserts
`pg_constraint.confdeltype = 'n'` for each, fails closed). The forward migration
alone never reaches the already-drifted prod Neon DB (its journal `when` sits
below prod's migration high-water mark — same trap as notifications/0041).

**Non-obvious landmine — the referenced COLUMN can be missing entirely.** On
the shared/prod DB, `sfdc_leads.converted_account_id` did not exist at all: the
table was created by an early `drizzle-kit push` BEFORE the column-defining
migration (0001), so 0001's `CREATE TABLE IF NOT EXISTS sfdc_leads (...)` was a
no-op and never added the column. A bare `ADD CONSTRAINT ... FOREIGN KEY
(converted_account_id)` then fails with `column "converted_account_id"
referenced in foreign key constraint does not exist`.
**Why:** caught only by the e2e migration run, not by dev typecheck or an
ephemeral fresh-DB test (fresh DBs build cleanly from 0001).
**How to apply:** a forward FK migration on a drift-prone table must
`ALTER TABLE ... ADD COLUMN IF NOT EXISTS <col> <type>;` (matching the schema's
nullable type) BEFORE the drop+recreate of the FK, so the constraint can always
be created. Idempotent + a no-op where the column already exists.

## Sibling landmine — deleting a sales_CONTACT (0067)

A full audit of every FK in `lib/db/src/schema/sales*.ts` + `sfdcIntegration.ts`
found that `sfdc_leads.converted_contact_id` was the LAST remaining implicit-
RESTRICT FK. It was created in 0001 as `REFERENCES sales_contacts(id)` with no
ON DELETE, and 0066 only healed its sibling `converted_account_id`. So deleting
a `sales_contacts` row that was ever a lead's conversion target 500s the same
way an account delete used to. Healed by 0067 (SET NULL) + a fail-closed
self-heal, mirroring the 0066 approach.
**Non-obvious:** an FK can live in the DB while being ABSENT from the drizzle
schema — `converted_contact_id` was a plain `integer(...)` in the source (no
`.references()`), so the landmine was invisible at the schema level. When
auditing onDelete, the drizzle schema is NOT the source of truth for what FKs
actually exist in prod; grep the migration SQL too.
**Audit result:** every other sales/sfdc FK is already CASCADE (owned children:
contacts/sends/hotlinks/briefings/field_mappings/sync_log) or SET NULL
(historical: campaigns/opportunities/leads/inbound). Note also a separate, NON-
failing drift: `sales_email_sends.contact_id`/`hotlink_id` and
`sales_inbound_emails.contact_id`/`account_id` are declared as FKs in the schema
but were never created as FKs in the DB (plain integers in 0000) — they leave
orphans, not 500s, so they're out of scope for "deletion fails".
