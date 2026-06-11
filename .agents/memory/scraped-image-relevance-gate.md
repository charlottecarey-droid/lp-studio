---
name: Scraped-image strict-pass relevance gate
description: How the LP/microsite generator keeps off-topic page-reference scrapes out of image slots, and the scoring artifacts that defeat it.
---

# Scraped-image strict-pass relevance gate

In the generator image pipeline (`findBestImage` / `scoreImage` / `fillEmptyImages` in `generate-page.ts`, reused by `generate-microsite.ts`), images come in two classes:
- **curated** — drawer uploads, brand-import photography, AI, purpose-tagged.
- **scraped** — page-reference harvests mirrored from a reference site at page-create, tagged with provenance meta-tags only (`scraped`, `page-reference`, `refhost:<host>`), NOT content/purpose tags.

**Rule (current):** in the STRICT fill pass, CURATED images fill on a non-negative total `score >= 0` (purpose boost + topical content + sibling nudge) — there is NO separate topical sub-gate. The late-May curated `lp-feature` rejection (reject when `contentScore <= 0` AND a topical tag was present) was REMOVED per explicit user request: it was starving dentures / product-grid / photo-strip slots of the tenant's OWN purpose-matched library photos. A tenant's own `lp-feature`/`product-detail` image now fills its slot even when its tags don't textually overlap the page context. Do NOT reintroduce a curated topical gate — "use my own product images" beats "leave it empty / fall to a generic fill".

**Scraped + starter images are NOT gated on `contentScore`.** They are DEFERRED out of the strict pass via the `deferred` flag (a scraped image that isn't THIS run's current-reference, or a starter seed) and only compete in the RELAXED last-resort pass, which runs AFTER AI image-gen. Origin tiering (best curated/current-ref ?? stale scraped ?? starter) is the real ordering — see `image-fill-pool-ordering.md`. `scoreImage` still RETURNS `contentScore` but `findBestImage` no longer consumes it; `hasTopicalTag` was deleted with the gate.

**Trusted-scrape mechanism REMOVED.** The old `buildTrustedScrapedIds` set + `score >= 0` freebie for current-ref scrapes is gone — with reliable auto-tagging it let purpose-only generic scrapes win slots. Do NOT reintroduce a trusted-set that bypasses relevance. `findBestImage` does not take a `trustedScrapedIds` param; `fillEmptyImages(blocks, images, ctx, relaxed, logoUrls)` is its full signature.

**Per-candidate gate:** `findBestImage` evaluates the gate PER candidate and picks the highest-scoring *acceptable* image (not "global best, then gate once") so an ineligible top scorer doesn't blank a slot a lower acceptable candidate could fill.

**Why the gate alone is not enough — two scoring artifacts that silently lift scrapes above 0:**
1. **Empty context words.** `scoreImage`'s context comes from splitting a space-padded template (`` `${a} ${b} ${c}` ``), so `contextWords` routinely contains `""`. `word.includes("")` / `"".includes(word)` are ALWAYS true, so every tag of length > 3 scored +1 against an empty word. Guard with `w.length > 0` (mirrors the title-match's existing `w.length > 3`).
2. **Provenance meta-tags are not semantic.** `"page-reference"` partial-matches the word `"page"` — ubiquitous in "landing page" prompts — so it scored +1 in normal contexts. Treat `scraped`/`page-reference` as `SKIP_TAGS` and skip the dynamic `refhost:` tag by prefix in `scoreImage`.

**How to apply:** any change to relevance scoring must preserve the documented invariant that a scraped image scores 0 unless it has a real content-tag or title match. If you add new provenance/meta tags to scraped rows, also exclude them from scoring or they'll re-inflate scrapes past the strict gate. Verify with a test using context containing generic words like "landing page".

**Orchestration ordering (both generators must match):** strict fill → (if AI image-gen enabled) relaxed CURATED-only fill [`fillPool.filter(!isScrapedImage)`] then AI fill → UNCONDITIONAL final relaxed fill over the FULL pool. `fillEmptyImages` only fills EMPTY slots, so the final pass never overwrites template-restored images or earlier picks. The microsite generator historically had NO relaxed pass at all — it needs both added.
