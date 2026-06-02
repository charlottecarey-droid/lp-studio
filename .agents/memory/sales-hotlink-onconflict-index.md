---
name: sales_hotlinks ON CONFLICT index (now self-healed)
description: ensureHotlinkForContact ON CONFLICT (contact_id,page_id) needs a partial unique index that drizzle's high-water-mark skips on drifted DBs; now re-created by a fail-closed self-heal in migrate.ts.
---

`ensureHotlinkForContact` (api-server sales/campaigns.ts) inserts with
`ON CONFLICT (contact_id, page_id) WHERE contact_id IS NOT NULL`. Postgres
validates that target against an existing index at plan time, so it requires the
PARTIAL unique index `sales_hotlinks_contact_page_unique` created by migration
**0017**. On the shared Neon DB, 0017 was journaled below drizzle's migration
high-water mark, so drizzle skipped it forever and the index was absent — every
hotlink mint threw `42P10` ("no unique or exclusion constraint matching the ON
CONFLICT specification").

**Symptom:** campaign send/preview silently fails to resolve `{{microsite_url}}`
(caller catches the throw, leaves the token empty → personalized link blank). The
user-visible report was "campaigns won't work"; an unrelated transient surfaced as
"Failed to create template" in the Quick Campaigns wizard (template creation
itself returns 201 server-side once tenant_id columns exist).

**Fix (durable):** a fail-closed self-heal step in `migrate.ts` (same pattern as
the 0066/0067 FK heals) runs on every boot, independent of drizzle's dedup: it
logs+collapses any duplicate `(contact_id,page_id)` rows keeping the lowest id,
re-runs the idempotent `0017` `CREATE UNIQUE INDEX IF NOT EXISTS`, then asserts
the index exists, is `indisunique`, and carries the `contact_id IS NOT NULL`
predicate (aborts release otherwise). Verified on Neon: heal succeeds, no
duplicates existed (no warn logged).

**Why the dedup is safe:** while the index was missing, every ON CONFLICT insert
threw, so no new rows accrued; the click route (`track/click-hotlink`) redirects
to the destination URL carried in the link's query string regardless of whether
the hotlink row exists; and `sales_email_sends.n -> sales_hotlinks.id` is ON
DELETE SET NULL. Keeping the oldest row preserves the most-likely-already-shared
token.

**How to apply:** integration tests can now assume `microsite_url` resolves from a
seeded account+contact+page after migrate runs. If you still see 42P10 on a fresh
DB, the self-heal step didn't run — check migrate.ts ordering.
