---
name: Conversion-scoring shape-based block detection
description: Why analyzeBlocks must detect features by object/prop SHAPE, not exact prop names, and why imageCount and hasImagery are split.
---

# Conversion-scoring must detect by shape, not by exact prop name

`analyzeBlocks` (api-server LP conversion-scoring) scores pages by detecting hero,
social proof, booking, imagery, and trust signals. Premium all-in-one blocks
(e.g. `business-case-premium`) and the DSO family store that content under
**bespoke prop names** — hero under `heroHeadline`/`heroLayout`, stats under
`situationStats`/`mathStats`/`signalCards`, quotes under
`proofFeatured`/`proofSecondary`, comparison under `shiftRows`, final CTA under
`showFinalCta`+`finalCtaPrimaryText`, images under `heroImageUrl`/`proofImageUrl`.

**Rule:** detect by SHAPE, not by a fixed allow-list of prop names.
- Social proof: any array whose key ends in `stats`, or any array containing an
  object with `quote` || `stat` || (`value` && `label`); plus a `proof*` object
  with a quote.
- Trust (kept DISTINCT from social proof — never use a `trust` substring or the
  social-proof `trust-bar` flips): comparison type keywords
  `comparison|versus|paradigm`, or `promises[]` / `oldWayItems[]`+`newWayItems[]`
  / `trustLine` / `guarantee` / `badges` props, or comparison-row objects
  (`oldWay`||`withDandy`||`traditional`).
- Booking: a premium block's `showFinalCta !== false` + non-empty
  `finalCtaPrimaryText` is the conversion path even without a dedicated cta block.

**Why:** without shape detection, a complete bespoke page scored 52 (C-) despite
having hero+stats+quotes+CTA+images+comparison; DSO microsites scored Trust=D
because comparison blocks weren't counted. After: that page -> 88, microsites -> ~88
(Trust D->B).

## imageCount vs hasImagery — keep them SEPARATE
- `imageCount` = NARROW (image/gallery/video/photo/carousel types or `images[]`).
  It feeds the Page Speed proxy (`100 - blockCount*3 - imageCount*5`), so
  broadening it would falsely tank speed on image-rich pages.
- `hasImagery` = BROAD (any `*ImageUrl`/`imageUrls`/`imageKey`/`image(s)` prop).
  It feeds Visual Hierarchy only, fixing false "add an image" on premium blocks.
- `isImageKey` must EXCLUDE image-config look-alikes (`heroImageTone`,
  `heroImageZoom`, `heroImageFocus`, `heroImageCaption`).
**Do not merge them back** — that reintroduces either false speed penalties or
false visual misses.

## Verifying against real data
The `executeSql` tool hits a STALE 4-page DB. The real app DB is
`NEON_DATABASE_URL`. Verify scoring against real pages with a one-off `tsx`
script that imports `analyzeBlocks`/`computeConversionScore` and queries Neon via
`pg` (DATABASE_URL/NEON_DATABASE_URL present in the shell).
