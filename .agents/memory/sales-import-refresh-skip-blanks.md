---
name: Sales contact import skips blank fields on update
description: bulk contact import upserts matched contacts but must NOT null out columns the CSV omits
---

The Sales Console bulk contact importer (POST /sales/import/contacts) dedupes
incoming rows to existing contacts via a waterfall (SFDC id → email
case-insensitive → first+last name within account) and UPDATES the matched row
in place (preserving its id, so activity / microsites / briefings / account
linkage stay attached — no dupes).

**Rule:** on a MATCH update, only overwrite columns the CSV actually provides.
Row normalization maps empty cells to `undefined` (`.trim() || undefined`); the
shared `buildContactUpdate(r, accountId)` helper includes a field in the `.set`
object only when `!== undefined`. All three update branches go through it.
firstName/lastName are always set (validated non-empty per row). Insert path
still writes explicit nulls.

**Why:** users do partial "refresh" imports (same people, a few changed fields).
The old code set every column to `value ?? null`, so a trimmed CSV silently
wiped title/role/phone/email/etc. on existing contacts.

**Tradeoff:** a blank cell can no longer CLEAR an existing value. If explicit
clearing is ever needed, add an opt-in contract (sentinel like `__CLEAR__` or a
mode flag) — do NOT reintroduce null-on-blank.
