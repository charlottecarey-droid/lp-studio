---
name: Footer social links fall back to brand.socialUrls
description: Where the LP footer's social icons get their URLs, and the template gotcha that left them dead.
---

The block footer (`BlockFooter`) renders Facebook/Instagram/LinkedIn icons. Each
icon's URL is sourced as `props.<x>Url || brand.socialUrls.<x>`, and the whole
row shows when `props.showSocialLinks !== false && at least one effective URL`.

**Why this matters / the gotcha:**
- Brand Import scrapes social profile URLs and persists them to
  `lp_brand_settings.config` → `brand.socialUrls` (facebook/instagram/linkedin).
- Template footers ship with `showSocialLinks: true` but BLANK url props
  (templates can't know a tenant's socials). Before the fallback, those footers
  rendered NO icons while the scraped links sat unused → user-visible "footers
  never use scraped socials / dead links" complaint.
- `generate-page.ts` has a brand-aware footer injection that pulls
  `brand.socialUrls`, but ONLY when the page has no footer block and the tenant
  isn't Dandy — it does NOT cover AI-emitted or template footers. The render-layer
  fallback in `BlockFooter` is the universal fix because it covers every footer
  origin (template, AI, injected, manual, already-saved pages, SSR/prerender).

**How to apply:**
- Don't gate footer social icons on the block's own url props alone — always OR
  with `brand.socialUrls`.
- `showSocialLinks: false` is a real opt-out (Dandy injected footer, sales
  microsite, flagship template all set it deliberately) — respect it via
  `!== false`, never ignore it.
- `brand.socialUrls` is always present (DEFAULT_BRAND includes empty defaults),
  so optional-chain + empty-string fallback is enough; no crash risk in SSR.
- The builder default "Footer" block in block-registry.tsx is Dandy-branded
  (forest green, meetdandy columns, showSocialLinks:false) — a separate pre-existing
  Dandy-leak issue; leave it out of social-link scope.
