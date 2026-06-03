---
name: No-op migration must match prod's REAL constraint names
description: Why an "idempotent no-op on prod" schema migration must reuse prod's actual constraint/index names (from pg_constraint), not the names in a spec or drizzle-generated template.
---

A migration whose job is to be a TRUE no-op on prod (and only reconcile fresh
DBs to prod's shape) must reuse prod's **actual** constraint and index names,
discovered by querying `pg_constraint` / `pg_indexes` on the live DB — NOT the
names written in a spec doc or emitted by `drizzle-kit generate`.

**Why:** prod schema has drifted from what the checked-in migrations alone
produce. Example: `lp_integrations`'s composite unique is named
`lp_integrations_tenant_provider_key` on prod, but the Prompt-2 spec template
used `lp_integrations_tenant_provider_unique` and also added a redundant
`idx_lp_integrations_tenant_provider`. A `DO $$ IF NOT EXISTS (… conname =
'…_unique')` guard keyed on the spec name finds nothing on prod and ADDs a
SECOND duplicate composite unique (plus a duplicate index) — so the migration
is no longer a no-op; it mutates prod. Likewise the spec's `BEGIN/COMMIT`
wrapper is wrong: the drizzle node-postgres migrator already wraps the whole
batch in one transaction, so an inner `COMMIT` prematurely ends it.

**How to apply:** before writing any "no-op/idempotent" migration, audit the
live constraint/index names and FK clauses (presence + ON DELETE behavior) and
match them EXACTLY — same names, same (or intentionally-noted) cascade, no
extra indexes. Then prove it: run the real migrator against a prod COW clone
(STAGING) and diff the constraints before/after — they must be byte-identical.
Treat the spec/codegen as a starting point, prod as the source of truth.

Related: deferred/gap-numbered migrations (e.g. an 0072 journaled AFTER 0073)
must carry a `when` GREATER than every already-shipped sibling, or drizzle's
high-water-mark dedup skips them forever on already-migrated DBs.
