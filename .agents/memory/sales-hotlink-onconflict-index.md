---
name: sales_hotlinks ON CONFLICT index missing
description: ensureHotlinkForContact ON CONFLICT (contact_id,page_id) throws 42P10 on the shared Neon DB — the partial unique index it targets is absent.
---

`ensureHotlinkForContact` (api-server sales/campaigns.ts) inserts with
`ON CONFLICT (contact_id, page_id) WHERE contact_id IS NOT NULL`. On the shared
Neon DB used by dev + integration tests, **no composite unique index on
`sales_hotlinks(contact_id, page_id)` exists** (only single-column
`idx_sales_hotlinks_contact` + `idx_sales_hotlinks_page`). Postgres validates the
ON CONFLICT target against existing indexes at plan time, so every call throws
`42P10` ("no unique or exclusion constraint matching the ON CONFLICT
specification"). The code comment claims migration 0017 created it, but the index
is not present.

**Why it matters:** any campaign send/preview path that resolves
`{{microsite_url}}` via a freshly-created hotlink silently fails (the caller
catches the error and leaves the token empty → `microsite_url` renders blank).

**How to apply:** when writing integration tests for campaign send/preview, do
NOT assume `microsite_url` resolves from a seeded account+contact+page — the
hotlink insert will throw. Test URL-dependent behavior (e.g. plain-text
linkifying) with a literal URL in the body instead. If hotlink resolution is
genuinely needed, the missing partial unique index must be (re)created first.
