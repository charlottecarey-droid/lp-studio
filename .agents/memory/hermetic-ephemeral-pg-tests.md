---
name: Hermetic ephemeral-Postgres integration tests
description: How to write DB-constraint/DDL integration tests that must NOT touch prod Neon, in the api-server vitest suite.
---

Dev's `NEON_DATABASE_URL` points at **production** Neon, and `@workspace/db`'s
pool binds to it at import time. Any test exercising real DDL/FK/ON DELETE
behavior must stand up its OWN throwaway Postgres and repoint the env BEFORE the
first `@workspace/db` import.

**Pattern** (see `artifacts/api-server/src/test-utils/ephemeralPg.ts` +
`src/routes/sales/accountDelete.fkSetNull.integration.test.ts`):
- `startEphemeralPg()` uses local PG16 `initdb`/`pg_ctl`, unix-socket-only
  (`-c listen_addresses= -k <sockDir>`) so it can never collide with a running
  dev server or a parallel cluster.
- In `beforeAll`: start cluster → set `process.env.NEON_DATABASE_URL` &
  `DATABASE_URL` → THEN `await import("@workspace/db")` and the route modules
  dynamically. Any static top-level import of `@workspace/db` defeats this.

**Why push, not the migration runner:** the repo's migration set is NOT
self-contained — the earliest migrations `ALTER TABLE` push-created tables
(e.g. `lp_sessions`) that the migrations themselves never `CREATE`, so
`drizzle-orm` migrate on a blank DB dies with `relation "lp_sessions" does not
exist` (42P01). Build the schema with `npx drizzle-kit push --force --config
./drizzle.config.ts` (spawnSync, cwd=`lib/db`, inherit `process.env`). push
reads the drizzle schema (the forward source of truth that GENERATES migrations
and carries the same `onDelete` rules a fix-migration installs on drifted prod),
so it's the right thing to guard against FK-regression anyway.

**Legacy migration-only tables:** a delete/cleanup chain may touch tables that
exist in prod (created by raw SQL migrations) but are NOT in the drizzle schema
(`lib/db/src/schema`), so `push` never creates them on the blank DB → 42P01 at
runtime. Stub each with a minimal `CREATE TABLE IF NOT EXISTS <t> (id serial
PRIMARY KEY, tenant_id integer)` after the import if the code only filters them
by `tenant_id`. Examples seen in the superadmin tenant-delete chain:
`lp_personalized_links`, `lp_block_defaults`, `lp_brand_presets`,
`lp_custom_blocks`, `lp_integrations`, `lp_library_items`, `sales_audiences`.

**Gotchas:**
- `pg_ctl start` MUST get `-l <logfile>`; otherwise the daemonized postmaster
  inherits spawnSync's stdio pipes, never sends EOF, and spawnSync hangs forever.
- Running vitest backgrounded (`setsid … &`) shows an EMPTY log mid-run because
  vitest buffers and only flushes results at the end — it looks hung but isn't.
  Verify by running foreground with `timeout 110 npx vitest run <file>
  --reporter=verbose`; the full ephemeral-PG + push + 2 tests finishes in ~26s.
