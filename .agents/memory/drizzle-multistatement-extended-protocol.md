---
name: Running a multi-statement .sql via drizzle vs raw pool
description: Why db.execute(sql.raw(multiStatement)) fails and how to run a whole .sql file in one round-trip
---

To execute a whole `.sql` file (multiple `;`-separated statements) in ONE
round-trip, use the raw pg pool with a SINGLE STRING argument:
`await pool.query(fileContents)`. That uses node-postgres' SIMPLE query
protocol, which permits multiple commands.

**Why:** drizzle's `db.execute(sql.raw(text))` calls
`client.query({ text, ... }, params)` with a params array (empty for raw). Any
params array forces pg's EXTENDED protocol, which allows exactly one statement —
a multi-statement string then throws `cannot insert multiple commands into a
prepared statement`. Same trap with `client.query(text, [])` directly: the empty
array still selects the extended path.

**How to apply:** When applying an idempotent DDL/seed `.sql` file wholesale
(e.g. the notifications schema self-heal in `artifacts/api-server/src/migrate.ts`),
read the file and `pool.query(string)` it — do NOT route it through
`db.execute(sql.raw(...))`. If you must use the ORM, split the file into
individual statements first (fragile if any string literal contains `;`).
