---
name: Production DB is Neon, not the Replit-managed Helium DB
description: The live app reads/writes Neon (NEON_DATABASE_URL); executeSql dev/production targets read the Replit-managed Helium DB, which is stale and unused. Critical for any DB-verification task.
---

# Production data lives in Neon, not the Replit-managed DB

`lib/db/src/index.ts` builds its pool from `process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL` — **Neon wins whenever it is set**. `NEON_DATABASE_URL` is set as a project secret AND is present in the agent's dev shell environment.

Consequences (all non-obvious and easy to get wrong):

- The **live production app** reads/writes the Neon database (`neondb`, host `ep-…-pooler…aws.neon.tech`). That is the real source of truth for prod data.
- `executeSql({ environment: "production" })` and `executeSql({ environment: "development" })` both target the **Replit-managed Helium DB** (`heliumdb`, host `helium`), NOT Neon. The Helium "production" replica is **stale and effectively unused**: it had old schema (`lp_pages` with no `tenant_id`), 0 tenants, a handful of pages, and 0 `ai_generation_log` rows — none of which reflect the live app.
- Therefore: **do NOT use `executeSql` to verify production data for this project.** It will show empty/old data and mislead you into thinking a feature is broken. Query Neon directly instead (read-only `pg.Pool` against `process.env.NEON_DATABASE_URL`).
- **Danger:** running any script that imports `@workspace/db` (or otherwise reads `NEON_DATABASE_URL`) from the dev shell connects to **PRODUCTION Neon**, not dev. A drizzle insert "test" run via `tsx` in `artifacts/api-server` wrote a row straight into prod. For local DB experiments, force the Helium DSN explicitly or unset `NEON_DATABASE_URL` first.

**Why:** Task "Confirm AI generations are logged in prod" reported 0 rows over 24h. That reading came from the Helium replica (via executeSql). The real Neon prod DB already had successful `ai_generation_log` rows flowing — logging was working all along. The whole investigation hinged on querying the correct (Neon) database.

**How to apply:** Any time you need to read/verify production (or even confirm what the running app sees), connect to `NEON_DATABASE_URL` directly with a read-only query. Treat `executeSql` results for this project as "Helium only," which for prod is stale.
