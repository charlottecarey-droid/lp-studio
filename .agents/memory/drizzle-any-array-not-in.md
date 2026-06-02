---
name: Drizzle ANY(array) vs IN(array)
description: Why session_id = ANY(${jsArray}) throws only on non-empty arrays, and the ARRAY[...]::type[] fix.
---

Passing a bare JS array into a Drizzle template for `= ANY(${arr})` is broken.

**Why:** Drizzle expands a bare JS array into a parenthesised *param tuple* `($1,$2,…)`. That is valid syntax for `col IN (...)` but INVALID for `col = ANY(...)` — Postgres `ANY` requires a real array. It throws ONLY when the array is non-empty (empty array emits nothing and silently "works"), so the bug hides on low-traffic data and surfaces on high-traffic pages. Symptom seen: page-detail visits route "Could not load visits" only on pages with anonymous sessions.

**How to apply:** Build a true array param:
`const arr = sql\`ARRAY[${sql.join(items.map(s => sql\`${s}\`), sql\`, \`)}]::text[]\`;`
then `col = ANY(${arr})`. (Or use a `::int[]`/`::text[]` cast at the call site, as hydrate-custom-schema.ts already does.) Never feed a bare JS array to `ANY()`.
