---
name: Reference-image harvest grace window vs. mirror tag bound
description: Why freshly-scraped reference-page images get saved to the library but never used on the page that requested them, and the consumer-side timing fix.
---

# Freshly-scraped reference images miss the page that requested them

Symptom: a user pastes a reference URL into the generate modal and asks the app
to use that page's images. The app scrapes them (they appear in the media
library afterward) but the generated page does NOT use them — "scrapes them then
won't use them."

**Root cause — producer/consumer timing mismatch (not the selection logic).**
In `generate-page.ts` the freeform path harvests the reference site's images via
`mirrorReferenceImages` (`assets-uploader.ts`), kicked off as `scrapedMediaPromise`
so it overlaps the LLM composer call. The consumer then does
`Promise.race([scrapedMediaPromise, timeout(SCRAPED_MEDIA_GRACE_MS)])`, falling
back to `[]` (drawer-only pool) on timeout.

The trap: the mirror does NOT just fetch+upload — it **awaits per-image GPT-4o
vision tagging** (bounded `AUTO_TAG_TIMEOUT_MS = 25s` each, parallel) before
returning, BY DESIGN, so the page sees real purpose/hero tags. Under shared-AI-
proxy contention (up to `MAX_REFERENCE_PHOTOS`=12 tag calls queued behind this
generation's own composer call) that tagging routinely outlasts the LLM. The old
grace window was **8s** — far below the producer's ~25s bound — so it abandoned a
still-tagging harvest: `scrapedMedia` resolved to `[]`, the fresh scrapes never
entered `buildReferenceFillPool`, and they were never flagged `currentReference`
→ never eligible in the strict fill pass. Meanwhile the mirror finished a beat
later and persisted the rows, so they showed up in the library but not on the page.

**Why the catalog safety net doesn't rescue the first run.** `mediaCatalog` is
fetched in the same `Promise.all` as the scrape, BEFORE the mirror runs, so the
just-mirrored rows aren't in it. `buildReferenceFillPool`'s `currentRefScraped`
(catalog rows whose host matches a reference URL) therefore only kicks in on a
SECOND generation against the same URL (rows now in the catalog). First run
depends entirely on `scrapedMedia` arriving in time.

**Fix:** raise `SCRAPED_MEDIA_GRACE_MS` to match the producer's bound (25s).
**Why this is not a flat latency add:** `Promise.race` resolves the INSTANT the
harvest settles, so we only ever wait as long as the harvest genuinely needs —
and only when the user actually pointed us at a reference URL. The harvest also
overlaps the multi-second LLM call, so in the common case it's already resolved
and the larger cap adds ~0 wall-clock. A pathologically slow CDN/tagger still
falls back to the drawer-only pool at the cap.

**How to apply / guardrails:**
- Do NOT "fix" this by decoupling tagging from the mirror's return (fire-and-
  forget background tag): Autoscale can freeze/reclaim the instance after the HTTP
  response, so post-response tagging may never complete → rows keep provenance-
  only tags forever. The awaited-tag design exists for that reason.
- Do NOT touch the selection logic (source-page hero rule, tier ordering, strict
  relevance floor) for this symptom — once the scrapes reach the pool flagged
  `currentReference` they fill hero (the one `lp-hero`) + feature slots correctly.
- If you ever lower `AUTO_TAG_TIMEOUT_MS` or change `MAX_REFERENCE_PHOTOS`, keep
  the consumer grace ≥ the realistic harvest bound or this regresses.
- No test couples to the grace constant; `generate-page.images.test.ts` (158
  tests) is the regression suite for the fill pipeline.
