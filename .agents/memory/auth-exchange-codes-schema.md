---
name: Drizzle journal must list every migration
description: Adding a .sql file under lib/db/migrations/ does NOT apply it. Drizzle's tracked migrator only runs files registered in meta/_journal.json — a missing entry silently skips on every release and prod ends up without the column/table.
---

The api-server's release build calls `drizzleMigrate(db, { migrationsFolder: lib/db/migrations })` on every deploy. That helper does **not** scan the directory — it iterates `meta/_journal.json` and runs each listed `.sql` file at most once (tracked in the `drizzle.__drizzle_migrations` table). A `.sql` file with no journal entry is invisible to it. No error, no warning — just silently skipped on every release forever.

Caught this twice now, both as the same prod symptom:
- `0031_auth_exchange_codes_target_host.sql` (target_host column) → prod OAuth callbacks failed with `column "target_host" of relation "auth_exchange_codes" does not exist` → cross-domain handoff broken → every tenant login (lpstudio.ai subdomains AND custom domains) appeared as "routing broken".
- `0033_ai_generation_log` (table missing entirely) → `/api/lp/generate-page` succeeded but observability insert threw a warn on every generation.

**Rule:** when adding a column or table:
1. Update `lib/db/src/schema/*.ts` (Drizzle schema is the source of truth for types).
2. Write the `.sql` under `lib/db/migrations/`.
3. **Append an entry to `lib/db/migrations/meta/_journal.json`** with the next idx, `version: "7"`, a strictly-monotonic `when` (the rest of the file uses 1700000000000 + idx-bumped offsets), and `tag` matching the filename without `.sql`. Without this step, the file does nothing.
4. Restart the api-server workflow to apply locally; the same migration runs at the next prod publish via the release build hook.

**Why the post-merge script doesn't catch it:** `scripts/post-merge.sh` only runs a handful of `CREATE INDEX IF NOT EXISTS` statements and skips `drizzle-kit push` because it hangs on interactive rename prompts. The journal-driven migrator is the only thing that touches DDL in prod.

**How to spot it pre-deploy:** `diff <(ls lib/db/migrations/*.sql | xargs -n1 basename | sed 's/\.sql$//') <(jq -r '.entries[].tag' lib/db/migrations/meta/_journal.json)` should be empty. Anything in the left column is a silent-skip risk.
