---
name: auth_exchange_codes schema
description: The cross-domain auth handoff table must stay in the Drizzle schema, not only in raw SQL migrations, or Publish will not sync new columns to prod.
---

The `auth_exchange_codes` table backs the cross-domain OAuth handoff (callback on `app.lpstudio.ai` mints a code → redirect to tenant host's `/api/auth/accept`). Any column on this table — `target_host`, future fields — MUST be defined in `lib/db/src/schema/authExchangeCodes.ts`.

**Why:** This project's `lib/db/migrations/*.sql` files are NOT applied automatically. `scripts/post-merge.sh` only runs a handful of `CREATE INDEX IF NOT EXISTS` statements and explicitly skips `drizzle-kit push` because it hangs on interactive rename prompts. The only path that updates production schema is the Publish flow, which diffs the **Drizzle schema source-of-truth** against prod. Tables/columns that exist only in raw SQL migration files are invisible to that diff and silently miss every publish.

**How to apply:** When adding a column to any auth/session-related table, (1) update the Drizzle table definition in `lib/db/src/schema/`, (2) apply to dev via `executeSql` DDL (drizzle push hangs on unrelated renames), (3) tell the user to re-publish so the diff carries the change to prod. Symptom of forgetting this: prod returns `column "X" of relation "Y" does not exist` (PG code 42703) from the OAuth callback, the outer catch redirects to `/?error=auth_failed`, and every tenant login is broken.
