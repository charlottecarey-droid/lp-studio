---
name: notification_sends missing on the shared dev Neon branch
description: Why 0041_notifications DDL is silently absent on already-migrated DBs and how it surfaces
---

On the shared dev Neon branch, `notification_sends` / `notification_templates`
(from `lib/db/migrations/0041_notifications.sql`) physically DO NOT EXIST even
though 0041 is listed in `meta/_journal.json` — so any e2e touching the inbox
fails with `relation "notification_sends" does not exist`, while the api-server
sweep still returns 200 (the in-app dispatcher catches+logs the insert error).

**Why:**
- The drizzle node-postgres migrator applies a journal entry only when its
  `when` is GREATER than the max `created_at` already in
  `drizzle.__drizzle_migrations`. This dev branch's high-water mark is
  1749600000000 (0043's `when`), but only ~22 migrations were physically
  applied — the journal was hand-renumbered (round-number `when` values) after
  this DB had already been migrated. 0041's `when` (1749400000000) sits BELOW
  the high-water mark, so the migrator skips it forever. A FRESH/CI DB applies
  all entries in order from empty, so it gets the table — the gap is
  drifted-existing-DBs only.
- This is the inverse of the "journal must list every migration" landmine: a
  late-inserted `.sql` whose `when` is below an existing DB's high-water mark is
  just as silently skipped as a missing journal entry.

**How to apply:**
- DURABLE FIX now in place: `migrate.ts` re-applies `0041_notifications.sql`
  every release via a `runStep` AFTER the drizzle migrate, independent of
  drizzle's high-water-mark dedup, so any drifted DB self-heals. The file stays
  the single source of truth (it is read from `MIGRATIONS_FOLDER`, not
  duplicated). Same pattern fits any other table-existence-critical DDL.
- This self-heal step fails CLOSED (it does NOT swallow errors like the data
  backfills around it): after applying the SQL it asserts both tables exist via
  information_schema and throws otherwise, so a broken self-heal aborts the
  release instead of shipping an api-server that silently drops notifications.
- Runtime regression now fails LOUDLY: the dispatcher classifies Postgres 42P01
  / 42703 as structural (`isStructuralDbError`) and RETHROWS instead of
  swallowing; the trial sweep rethrows structural errors so
  `/api/_test/run-trial-sweep` returns 500. Transient insert errors are still
  tolerated (logged + counted in `DispatchResult.inAppFailed`).
- PRODUCTION (Neon) was VERIFIED healthy May 2026: both tables exist + all 4
  seeded template rows present; only the stale Helium dev DB was missing them.
  Verify with a real `information_schema.tables` query against the right DB
  (Neon for prod), not by trusting a 200 from the dispatcher.
