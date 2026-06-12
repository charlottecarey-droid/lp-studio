---
name: Scraped-image source-page hero rule
description: A scraped image may be a hero only if it was the hero on its source page; enforced at tag + stale-data + selection layers.
---

# Scraped-image source-page hero rule

**Rule:** A SCRAPED (page-reference) image may occupy a hero slot ONLY if it was
the actual hero on the scraped source page. Every other scrape is `lp-feature`.

**Why:** The GPT-4o-mini auto-tagger (`imageAutoTag.ts`) assigns the `lp-hero`
purpose by image CONTENT alone, so a mid-page employee headshot got tagged
`lp-hero` and surfaced as a microsite hero. The user's explicit rule: only the
source-page hero may become a hero image.

**Source-page hero detection:** `collectImagesFromDom`
(`brand-import/extractors/photography.ts`) returns content images in document
order (chrome / logos / icons / sub-200px already excluded), so the FIRST
candidate is the page hero region. `og:image` is separate and never mirrored.

**How to apply — enforce at THREE layers (a new hero-fill path needs all three):**
1. **Tag time** — `autoTagImage(..., { forbidHeroPurpose })` downgrades a
   model-returned `lp-hero` to `lp-feature`. In `mirrorReferenceImages`
   (`assets-uploader.ts`) only `candidates[0]` (== `heroTag`) is allowed to keep
   `lp-hero`; all later candidates pass `forbidHeroPurpose:true`. Brand-import
   photos allow only `i===0`.
2. **Stale data** — the dedup-reuse path in `mirrorReferenceImages` strips
   `lp-hero` from non-hero deduped rows still carrying it (in-memory + best-effort
   `db.update`), so already-scraped rows obey the rule. Required because the Dandy
   microsite hero pool (`generate-microsite.ts` `applyDandyHeroVariability`)
   HARD-FILTERS on `tag==="lp-hero"` and would otherwise keep a stale mis-tag.
3. **Selection** — BOTH `findBestImage` (fill pass, strict+relaxed) AND
   `validateAndDedupeAIImages` Pass 2 (model-assigned URLs) hard-skip/clear a
   hero slot when `isScrapedImage(img) && getImagePurpose(img) !== "lp-hero"`.
   Purpose mismatch alone is only a SOFT penalty (-2/-10), so a topically-strong
   non-hero scrape would survive without the hard gate. Curated / brand-import /
   AI / starter images are unaffected (only scrapes are gated).

**Consequence:** a hero slot with no eligible image stays empty and falls through
to AI/editor fill — preferred over shipping a wrong hero. A fill-pass test that
asserted a purposeless scrape filling a hero slot was retargeted to a feature
slot (its real intent was pool-order independence, not hero eligibility).
