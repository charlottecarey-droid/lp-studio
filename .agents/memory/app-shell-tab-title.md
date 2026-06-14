---
name: App-shell browser-tab title + OG suppression
description: Title/OG contract for authenticated lp-studio tenant app pages, and why a page's own title effect still wins over AppLayout
---

# App-shell tab title + OG

**Contract:** authenticated tenant app pages set the tab title to
`LP Studio - {Tenant Name} - {Page Name}` and carry **no** `og:image`,
`og:description`, or `meta[name="description"]`. "LP Studio" is the fixed
workspace prefix (the sidebar always reads LP Studio regardless of tenant brand);
tenant name comes from BrandConfig; page name comes from a route→name map.
Centralized in `AppLayout` (one location-keyed effect) + `lib/app-page-title.ts`.

**Why the effect ordering matters (the non-obvious part):** `AppLayout` is
rendered PER-PAGE as a CHILD of each page component, NOT as a stable parent
around the router. React runs child effects before parent effects, so a page
that sets its own `document.title` (e.g. analytics `page-detail` →
`"{pageTitle} · {brand}"`) runs AFTER AppLayout's effect and still wins — this is
intentional and out of scope for the shared format. An earlier code comment
claiming "AppLayout persists across admin route changes" was wrong; it remounts
on navigation.

**How to apply:** new app route → add its route→name entry to the page-name map
(most-specific prefix first). Routes rendered WITHOUT AppLayout (builder,
block-test editor, public landing-page viewer, draft preview) own their titles
and are unaffected. Unmapped app routes fall back to the tenant `defaultOgTitle`.
