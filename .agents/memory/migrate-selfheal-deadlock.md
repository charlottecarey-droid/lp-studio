---
name: Migration self-heal deploy deadlock
description: Why FK/constraint self-heal steps deadlock the zero-downtime publish, and the probe-first + retry fix pattern.
---

# FK/constraint self-heal steps deadlock the zero-downtime publish

api-server runs DB migrations as a production deploy hook (`dist/migrate.mjs`)
WHILE the previous instance is still serving live traffic. Any self-heal step
that issues `ALTER TABLE` / `DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT`
**unconditionally** takes `AccessExclusiveLock` on the table(s) involved — for an
FK, on BOTH the child and the referenced parent — *even when the constraint is
already correct*. That collides with the live app's `RowExclusiveLock`s and
Postgres aborts one side with a deadlock (SQLSTATE `40P01`); when it picks the
migrate, the deploy hook exits non-zero and the **publish fails**.

**Rule:** an idempotent constraint/FK self-heal must PROBE the catalog first with
a `SELECT` (`AccessShareLock` only, never deadlocks against writers) and SKIP the
locking DDL entirely when the desired state already holds. Only a genuinely
drifted DB falls through to the `ALTER`, then re-asserts and fails CLOSED. In
migrate.ts this is the GENERALIZED `runProbedSelfHeal({name, applySqlFile,
checkSql, expected, shortfall})` — it covers FK steps AND every file-based
CREATE-TABLE/ADD-COLUMN self-heal (e.g. 0041/0049/0051/0054-0060/0064/0074/0076,
plus combined-count probes for marketo 0077 and hubspot 0081 where
expected = #tables + #columns). The bespoke 0017 partial-unique-index step keeps
its dup-cleanup but now has an early catalog probe too. The probe predicate MUST
schema-qualify (`nspname='public'`) AND, for an index, qualify by OWNING TABLE
(not index name alone) + verify `indisunique` + predicate + key columns — a
false-POSITIVE skip (skipping when the object is wrong/missing) is the real bug;
a false-NEGATIVE just falls through to the safe idempotent DDL.

**Also:** wrap the whole migration body in retry-on-transient-lock
(`runMigrationsBodyWithRetry`, codes `40P01`/`40001`, bounded exp backoff) so the
genuinely-needed DDL on a drifted DB still survives a transient race; the migration
advisory lock is held across retries. Retry ALONE is insufficient — under a
continuously-writing competitor the deadlock is persistent, so the probe-skip is
the real fix.

**Why:** the self-heals were originally written "safe on every DB: DROP IF
EXISTS + ADD, no-op everywhere else" — but "no-op" still meant a full
`AccessExclusiveLock` cycle on every single deploy, which is exactly what
deadlocked under load.

**How to apply:** any new always-run self-heal that issues locking DDL (ALTER
TABLE, ADD/DROP CONSTRAINT, CREATE TABLE, CREATE INDEX non-concurrently) MUST be
written as `runProbedSelfHeal` (or carry an equivalent early catalog probe), or
it re-introduces the publish deadlock. As of this work ALL file-based self-heals
in migrate.ts (incl. 0017 index) are probe-first; do not add an unconditional
`pool.query(readFileSync(...))` self-heal step.

**Caveat on combined-count probes:** counting `#tables + #columns` (0077/0081)
does NOT verify unique constraints/indexes those files create. This is acceptable
because the .sql uses `CREATE TABLE IF NOT EXISTS`, so re-running on a
tables-exist DB is a no-op for constraints anyway (matches the original
post-apply check) — but if a file adds a constraint to an EXISTING table, the
probe must count that object too.
