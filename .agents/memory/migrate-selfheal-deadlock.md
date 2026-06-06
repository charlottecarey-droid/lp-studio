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
migrate.ts this is `runConstraintSelfHeal({checkSql, expected, ...})`; the probe
predicate MUST schema-qualify (`nspname='public'`) or a same-named table in
another schema overcounts and causes a false skip.

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
TABLE, ADD/DROP CONSTRAINT, CREATE INDEX non-concurrently) needs the same
probe-first guard, or it re-introduces the publish deadlock. Index self-heal
(0017) is the next candidate if contention persists.
