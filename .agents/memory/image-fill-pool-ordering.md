---
name: Image fill-pool source ordering (scraped vs starter)
description: The precise priority order buildReferenceFillPool must keep, and why starter seeds rank below scrapes
---

`buildReferenceFillPool` (artifacts/api-server/src/routes/lp/generate-page.ts,
shared by generate-page + generate-microsite) ranks empty-slot fill candidates:

  genuine curated → current-reference scraped → starter seeds → other-host scraped

**Why:** Starter seeds (STARTER_IMAGE_SEEDS, tagged "starter") and untagged
page-reference scrapes are BOTH purpose-neutral → both score 0 in scoreImage.
findBestImage keeps the FIRST max-scorer on ties, so whatever sits earlier in the
pool wins. Originally starter seeds lived in the `curatedImages` bucket (placed
first), so they beat the current reference's score-0 scrapes on every tie — the
"scraped images never used, irrelevant starters shown instead" symptom. Splitting
starter out (isStarterImage) and placing it AFTER current-reference scrapes lets
the requested site's imagery win. Genuine brand-import/upload/AI assets stay first
(they're the tenant's real assets). Stale unrelated-host scrapes stay last
(gated > 0; neutral starters are safer than off-brand stale scrapes as fallback).

**Per-generation bucket rotation (Task #1287).** `buildReferenceFillPool` takes
an optional `rotationSeed` (routes pass `Math.floor(Math.random()*1_000_000)+1`,
built ONCE per generation). It rotates EACH bucket independently via
`rotateBucket(bucket, seed)` (no-op when len<=1 or seed<=0) so cross-bucket
priority (curated → fresh → current-ref → other → starter) is preserved while the
starting offset WITHIN a bucket of interchangeable assets varies — fixes "same
on-topic photo wins the first slot on every page / across tenants". seed<=0 is a
deterministic no-op so unit fixtures keep fixed ordering.

**How to apply:** Never fold "starter"-tagged rows back into curatedImages. The
old trusted-scrape set (buildTrustedScrapedIds) is GONE — scraped images now pass
the strict gate only on `contentScore > 0` (see scraped-image-relevance-gate.md);
to exercise an off-topic current-ref scrape filling a slot, use relaxed-mode in
tests (it no longer passes strict). Keep seed defaulting to 0 in tests asserting
exact pool order.
