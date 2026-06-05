---
name: OG/SEO meta pipeline (LP Studio)
description: How marketing + tenant landing-page OG/meta tags reach non-JS social scrapers, and the multi-edit gotcha when adding a managed tag.
---

# OG/SEO meta pipeline

Two independent surfaces produce OG/meta, both reaching non-JS scrapers via
*pre-baked static HTML* (scrapers never run JS):

- **Marketing (lpstudio.ai)**: `usePageMeta` (client hook) sets head tags at
  runtime. `scripts/prerender-marketing.mjs` (Playwright over `/`, `/privacy`,
  `/terms`) bakes the hydrated head into `dist/public/*.html`. So to give a
  marketing route OG tags for scrapers you only need `usePageMeta` enabled on
  that page — no static `index.html` edit. A single Playwright page snapshots
  all routes sequentially, so `usePageMeta` MUST clear any tag it doesn't set
  (e.g. og:image) or it bleeds from the previous route.
  - **Apex title/description live in TWO places that must stay in sync:** the
    prerender bakes `usePageMeta` (home.tsx), but the LIVE apex ALSO runs a
    per-host override `<script>` in `index.html` (`isLpStudio` branch, sets
    `LP_TITLE`/`LP_DESC`/og:*). Editing the homepage Google title/description
    means editing BOTH or the rendered page and the baked HTML disagree. (The
    static base `<title>` in index.html is "Meet Dandy …" — the per-host script
    overrides it for lpstudio.ai hosts; tenant hosts get injectPageMeta.)
- **Tenant landing pages**: `api-server/src/lib/injectPageMeta.ts` is the
  source of truth; it strips + re-injects managed tags per page and writes to
  R2. Per-page isolation depends on every managed tag being in
  `MANAGED_TAG_PATTERNS` (strip) so clearing a column actually removes the tag.

## Gotcha: adding a managed tag in injectPageMeta needs THREE coordinated edits
1. Add it to `MANAGED_TAG_PATTERNS` (so stale copies are stripped — required
   for per-page isolation / clearing).
2. Add the actual `upsertHeadTag(...)` call in the injection block (this is the
   one easy to forget — without it the tag is silently never emitted; strip
   patterns + buildTags changes alone produce nothing).
3. If the value is derived, add it to `buildTags`.
**Why:** I once updated patterns + buildTags + the destructure but not the
injection block; output emitted none of the new tags and only unit tests
caught it.

## Scraper correctness rules baked in here
- og:image MUST be absolute. `injectPageMeta` normalises relative / root-
  relative / protocol-relative → absolute https on the canonical host;
  absolute http:// / https:// / data: are passed through verbatim.
- Use a small image. `public/opengraph.jpg` (1280x720, ~61KB) is the lpstudio
  OG; the 6.5MB `opengraph.png` made previews "rarely show" (scraper fetch
  timeouts). Don't reference it.
- Width/height are emitted only when known. `injectPageMeta` now accepts
  optional `ogImageWidth`/`ogImageHeight` and emits `og:image:width/height` only
  when BOTH are positive finite. Tenant pages now supply them via the cascade
  resolver (below), so the page's own card and the tenant default both ship a
  trustworthy 1200×630. Don't pass guessed sizes — a wrong size is worse than none.

## Tenant OG cascade resolver (single source of truth)
`api-server/src/lib/resolvePageOG.ts` (`resolveOGFields`) is the ONE place that
decides a tenant page's title/description/image+dims. Cascade per field:
per-page meta → tenant default (`tenants.default_og_title/description/image_url`,
real columns NOT brand JSONB; `{{page_title}}` token substituted in the title) →
page content (first block image) → system fallback. `triggerPublishedRender`
calls it ONCE per page (selecting the 3 default_og_* cols in its existing tenant
query) before `buildHtmlForHost`, feeding metaTitle/Description/ogImage+W/H.
**Why a separate resolver:** the same cascade must hold at publish-render time
AND at page-create pre-fill (`pages.ts` POST seeds empty meta via it). Keep all
callers going through it — don't re-implement the precedence inline.

## Tenant default share-card editing (brand-settings)
The "Default share card" panel in `brand-settings.tsx` reads/writes the 3 tenant
columns via `GET`/`PATCH /api/admin/tenant-settings` (admin-only), NOT
`saveBrandConfig` — it has its OWN save button (`handleSaveOgDefaults`) separate
from the main brand save. Per-page editor (BuilderEditor SEO panel) + this panel
share `components/og-share-card.tsx` (char-count bands title 50-60/desc 110-160,
1200×630 dimension warning + one-click `POST /lp/og-image/resize` sharp
center-crop, ~240px live `ShareCardPreview`). Keep both surfaces on that shared
module so they never drift.
