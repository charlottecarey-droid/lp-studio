---
name: Schema-drift guard (declared @workspace/db vs live DB)
description: Automated guard catching declared tables/columns missing from the live (shared Neon) DB, plus the self-heal remediation it points to.
---

# Schema-drift guard

There is now an automated guard that compares every table/column declared in
`@workspace/db` (the drizzle schema) against what physically exists in the live
database, and fails LOUDLY naming each missing object. It exists because the
shared Neon DB repeatedly drifts: drizzle's node-postgres migrator dedupes by a
high-water mark on the journal `when`, silently skipping migrations, and the
gap only surfaces later as a runtime "column/relation does not exist".

- Live-DB integration guard: `artifacts/api-server/src/migrate.schemaDrift.integration.test.ts` (gated on DB reachability, runs under `vitest run`).
- Pure helpers: `artifacts/api-server/src/lib/schemaDrift.ts` (introspection via `getTableConfig`/`is(PgTable)`, diff, migration-object index, self-heal parse, report) + `schemaDrift.test.ts` (no-DB unit + journal-completeness check).

**Why:** Every prior drift (notifications 0041, block_catalog 0049, Marketo
0077, HubSpot 0081) was caught only at runtime and patched one-by-one. This
guard catches the next one up front. On first run it caught a genuine drift:
`sfdc_leads.industry` / `sfdc_leads.rating` were declared but missing from the
live DB (originally in 0001's `CREATE TABLE IF NOT EXISTS`, which never
back-fills an already-existing table).

**How to apply:** When the guard fails, the fix is the codebase's standard
remediation — add a dedicated idempotent `ALTER TABLE ... ADD COLUMN IF NOT
EXISTS` migration (+ journal entry) AND a `runProbedSelfHeal({ applySqlFile,
checkSql, expected, shortfall })` step in `artifacts/api-server/src/migrate.ts`.
A new migration with a `when` above the high-water mark also heals via the
normal migrator; the self-heal is the belt-and-suspenders for already-drifted
DBs. Remember: the dev shell / these tests connect to PRODUCTION Neon
(`NEON_DATABASE_URL`), so a failure is real prod drift.
