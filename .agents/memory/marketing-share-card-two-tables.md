---
name: Marketing share cards — homepage vs secondary routes
description: The marketing site uses TWO separate OG share-card configs; know which before editing.
---

The marketing site (lpstudio.ai) has TWO independent superadmin-editable
share-card (OG) backends — do not try to consolidate them:

1. **Homepage** (`/`): a single-row OG config table + its own homepage-og
   endpoints, injected at prerender as a dedicated homepage global and read by
   an inline resolver in the homepage component. It IS seeded with defaults.

2. **Secondary routes** (features/pricing/for-marketing/for-sales/compare): a
   keyed OG table (PK = page key) + a `page-og/:key` endpoint pair, injected at
   prerender as a key→config map global and read via a shared `useShareCard`
   hook. It is NOT seeded — an absent row means "use the page's built-in
   defaults" (field-by-field fallback).

**Why the split:** the homepage shipped first as a single row; generalising to
a keyed table without disturbing the working homepage path was lower-risk than
migrating the homepage row into the keyed table.

**How to apply:** adding another marketing route's share card = add its key to
the server-side allowlist (unknown keys 404), call the shared hook in the page
with its built-in defaults, add a panel to the SuperAdmin Share Cards tab, and
ensure the route is in the prerender route list so its snapshot bakes the
configured OG tags for non-JS scrapers.
