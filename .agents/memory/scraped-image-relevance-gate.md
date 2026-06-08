---
name: Scraped-image strict-pass relevance gate
description: How the LP/microsite generator keeps off-topic page-reference scrapes out of image slots, and the scoring artifacts that defeat it.
---

# Scraped-image strict-pass relevance gate

In the generator image pipeline (`findBestImage` / `scoreImage` / `fillEmptyImages` in `generate-page.ts`, reused by `generate-microsite.ts`), images come in two classes:
- **curated** — drawer uploads, brand-import photography, AI, purpose-tagged.
- **scraped** — page-reference harvests mirrored from a reference site at page-create, tagged with provenance meta-tags only (`scraped`, `page-reference`, `refhost:<host>`), NOT content/purpose tags.

**Rule (current — content-relevance gate):** in the STRICT fill pass, curated images pass on total `score >= 0`, but scraped images must have a positive **CONTENT** relevance signal to win a slot — `scoreImage` returns `{ score, contentScore }` and the scraped gate is `contentScore > 0`. `contentScore` is topical tag/title overlap ONLY; it EXCLUDES the purpose boost/penalty and the foreign-tenant nudge. This holds for THIS run's reference scrape too — the user pointing us at a site does not make its generic imagery on-topic. Off-topic scrapes fall to the RELAXED last-resort pass (runs only AFTER AI image-gen), whose gate is a non-negative FLOOR (`score >= 0`) — never place a negative/purpose-mismatched candidate even as last resort. So: relevant images win; off-topic scrapes are last resort behind AI-gen; non-AI-gen tenants still get filled.

**Why content (not total) score for scrapes — root cause #4 (Task #1287):** the auto-tagger assigns PURPOSE tags (`lp-hero`/`lp-feature`/`product-detail`) to scrapes, so a generic off-topic reference photo scores the full `PURPOSE_MATCH_BOOST` (+8) on a matching slot with ZERO topical relevance — total `> 0` would pass it. Gating on `contentScore` is what actually keeps the generic office shot out.

**Trusted-scrape mechanism REMOVED (was Task #1218).** The old `buildTrustedScrapedIds` set + `score >= 0` freebie for current-ref scrapes is gone — with reliable auto-tagging it let purpose-only generic scrapes win slots (the symptom). Do NOT reintroduce a trusted-set that bypasses content relevance. `findBestImage` no longer takes a `trustedScrapedIds` param; `fillEmptyImages(blocks, images, ctx, relaxed, logoUrls)` is its full signature.

**Per-candidate gate:** `findBestImage` evaluates the gate PER candidate and picks the highest-scoring *acceptable* image (not "global best, then gate once") so an ineligible top scorer doesn't blank a slot a lower acceptable candidate could fill.

**Why the gate alone is not enough — two scoring artifacts that silently lift scrapes above 0:**
1. **Empty context words.** `scoreImage`'s context comes from splitting a space-padded template (`` `${a} ${b} ${c}` ``), so `contextWords` routinely contains `""`. `word.includes("")` / `"".includes(word)` are ALWAYS true, so every tag of length > 3 scored +1 against an empty word. Guard with `w.length > 0` (mirrors the title-match's existing `w.length > 3`).
2. **Provenance meta-tags are not semantic.** `"page-reference"` partial-matches the word `"page"` — ubiquitous in "landing page" prompts — so it scored +1 in normal contexts. Treat `scraped`/`page-reference` as `SKIP_TAGS` and skip the dynamic `refhost:` tag by prefix in `scoreImage`.

**How to apply:** any change to relevance scoring must preserve the documented invariant that a scraped image scores 0 unless it has a real content-tag or title match. If you add new provenance/meta tags to scraped rows, also exclude them from scoring or they'll re-inflate scrapes past the strict gate. Verify with a test using context containing generic words like "landing page".

**Orchestration ordering (both generators must match):** strict fill → (if AI image-gen enabled) relaxed CURATED-only fill [`fillPool.filter(!isScrapedImage)`] then AI fill → UNCONDITIONAL final relaxed fill over the FULL pool. `fillEmptyImages` only fills EMPTY slots, so the final pass never overwrites template-restored images or earlier picks. The microsite generator historically had NO relaxed pass at all — it needs both added.
