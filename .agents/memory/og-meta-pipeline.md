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
- Width/height are emitted only when known (marketing controls its own file);
  omitted for tenant images since a wrong size is worse than none.
