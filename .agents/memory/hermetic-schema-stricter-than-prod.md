---
name: Hermetic schema-true DB stricter than drifted prod
description: Raw INSERTs that omit/NULL columns can pass on prod but 500 on drizzle-kit-push DBs
---

INSERTs that pass `null` (or omit) a column declared `notNull().default("")` in the
drizzle schema will FAIL with a NOT NULL violation on a hermetic test DB built via
`drizzle-kit push` (schema-true), even though the same query succeeds against prod.

**Why:** prod tables predate later `notNull()` tightenings, so prod columns are often
still nullable (schema-vs-prod drift). The hermetic DB is built straight from the
current schema source, so it enforces the declared constraints. The drizzle error
message swallows the underlying pg cause ("Failed query: ... params: ..."), so probe
the raw INSERT via `pool.query` + `.catch(e => e.message + e.code)` to see it.

**How to apply:** when a raw `sql\`INSERT ...\`` route writes optional fields, insert the
schema DEFAULT (e.g. `?? ""`), not `?? null`, for any column declared
`.notNull().default(...)`. Caught in save-to-library (lp_proof_points attribution_*
columns) — saving a stat or title-less quote to the library was 500ing on schema-true DBs.
