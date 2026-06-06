---
name: Scraped-image strict-pass relevance gate
description: How the LP/microsite generator keeps off-topic page-reference scrapes out of image slots, and the scoring artifacts that defeat it.
---

# Scraped-image strict-pass relevance gate

In the generator image pipeline (`findBestImage` / `scoreImage` / `fillEmptyImages` in `generate-page.ts`, reused by `generate-microsite.ts`), images come in two classes:
- **curated** — drawer uploads, brand-import photography, AI, purpose-tagged.
- **scraped** — page-reference harvests mirrored from a reference site at page-create, tagged with provenance meta-tags only (`scraped`, `page-reference`, `refhost:<host>`), NOT content/purpose tags.

**Rule:** in the STRICT fill pass, curated images pass on `score >= 0`, but scraped images must have a POSITIVE relevance signal (`score > 0`) to win a slot. Off-topic scrapes fall to the RELAXED last-resort pass, which runs only AFTER AI image generation. So: relevant images (curated, or scrapes that genuinely match) win; irrelevant scrapes are last resort; AI-gen beats an off-topic scrape; non-AI-gen tenants still get filled (no empty slots).

**Why the gate alone is not enough — two scoring artifacts that silently lift scrapes above 0:**
1. **Empty context words.** `scoreImage`'s context comes from splitting a space-padded template (`` `${a} ${b} ${c}` ``), so `contextWords` routinely contains `""`. `word.includes("")` / `"".includes(word)` are ALWAYS true, so every tag of length > 3 scored +1 against an empty word. Guard with `w.length > 0` (mirrors the title-match's existing `w.length > 3`).
2. **Provenance meta-tags are not semantic.** `"page-reference"` partial-matches the word `"page"` — ubiquitous in "landing page" prompts — so it scored +1 in normal contexts. Treat `scraped`/`page-reference` as `SKIP_TAGS` and skip the dynamic `refhost:` tag by prefix in `scoreImage`.

**How to apply:** any change to relevance scoring must preserve the documented invariant that a scraped image scores 0 unless it has a real content-tag or title match. If you add new provenance/meta tags to scraped rows, also exclude them from scoring or they'll re-inflate scrapes past the strict gate. Verify with a test using context containing generic words like "landing page".

**Orchestration ordering (both generators must match):** strict fill → (if AI image-gen enabled) relaxed CURATED-only fill [`fillPool.filter(!isScrapedImage)`] then AI fill → UNCONDITIONAL final relaxed fill over the FULL pool. `fillEmptyImages` only fills EMPTY slots, so the final pass never overwrites template-restored images or earlier picks. The microsite generator historically had NO relaxed pass at all — it needs both added.
