---
name: Logo preservation in Replace-imagery pipeline
description: How logo images are kept out of the AI image-replacement pipeline so "Replace imagery" never swaps a brand mark.
---

The shared AI image pipeline (artifacts/api-server/src/routes/lp/generate-page.ts,
reused by sales generate-microsite.ts) protects logos in ONE place:
`collectImageSlots` filters out any slot whose current value `isLogoImageUrl(...)`.
Because the clear loop, dedupe/validation, and used-URL tracking all go through
collectImageSlots, that single filter covers them. `sanitizeAIImageUrls` needs a
SEPARATE guard (it has its own walk, not collectImageSlots) — without it, bundled
root-relative marks like `/dandy-logo-white.svg` get cleared as "hallucinated"
because they aren't under `/api/storage/objects/`.

**Why conservative detection:** a false positive only keeps a content photo the
user wanted replaced; a false negative swaps out their logo (the bug). So
`isLogoImageUrl` flags only: (1) exact tenant brand logo URLs from
buildBrandLogoUrlSet(brand.logoUrl/logoUrlDark, raw + pathname forms),
(2) bundled marks /dandy-logo.svg + /dandy-logo-white.svg by pathname, (3) a
"logo" filename token bounded by non-letters (matches acme-logo.svg, logos.png;
NOT catalogos.jpg).

**How to apply:** any new image-pipeline pass that can clear/replace an image
must either route through collectImageSlots(block, logoUrls) or call
isLogoImageUrl directly. aiFillEmptyImages / restoreTemplateImages act only on
EMPTY slots, so logos (never emptied) are inherently safe. The brand logo set is
threaded as an optional `logoUrls?: ReadonlySet<string>` last param on
collectImageSlots / validateAndDedupeAIImages / fillEmptyImages / sanitizeAIImageUrls.
