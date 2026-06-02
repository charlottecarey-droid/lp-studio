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
