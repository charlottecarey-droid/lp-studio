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
- To unblock e2e locally, apply the idempotent `0041_notifications.sql`
  (`CREATE TABLE IF NOT EXISTS ...`) directly to NEON_DATABASE_URL once; the
  test's own pg pool then finds the table.
- Suspect this whenever an inbox/notifications query 42P01s on a DB that
  otherwise has current tables — verify with a real `information_schema.tables`
  query, not by trusting a 200 from the dispatcher.
- PRODUCTION may have the same gap if it crossed the high-water mark before 0041
  was journaled — worth verifying notification_sends exists in prod before
  trusting the notifications feature there.
