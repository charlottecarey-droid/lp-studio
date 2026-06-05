---
name: Drizzle sql`` regex backslash collapse
description: Why \s (and other backslash escapes) silently break inside drizzle sql template-literal SQL, and what to use instead.
---

Inside a JS template literal (including drizzle's `sql\`...\``), an unrecognised
escape like `\s` collapses to a bare `s` BEFORE Postgres ever sees the string —
so a regex `'[-|]\s*LP Studio$'` reaches the DB as `'[-|]s*LP Studio$'` and
matches the letter s, not whitespace. The statement runs without error and just
matches nothing (silent no-op).

**Why:** A one-shot data-fix migration (strip a trailing "- LP Studio" suffix
from tenants.default_og_title) inserted its marker but updated 0 rows. The marker
guard then made it permanently a no-op on the shared Neon DB.

**How to apply:**
- In `sql\`\`` regexes use POSIX classes (`[[:space:]]`, `[[:alpha:]]`, …) which
  contain no backslash, OR double the backslash (`\\s`) so the literal carries a
  real `\`.
- A marker-guarded migration that shipped buggy has ALREADY recorded its marker
  on prod/shared DBs; bump the marker (…_v1 → …_v2) so the corrected statement
  re-runs. Deleting the marker from the dev shell does not help other DBs.
