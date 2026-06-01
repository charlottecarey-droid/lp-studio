---
name: Brand-import results cache poisoning
description: Why the brand-import URL scraper sometimes "won't even try to scrape" a site, and the all-failed guard that fixes it.
---

The brand-import orchestrator caches its result payload in the `lp_brand_import_cache`
table (keyed by normalized host+path) for a 24h TTL. The cache read is the FIRST
thing `runOrchestrator` does, before any scraping.

**Failure mode:** a single transient TOTAL failure (AI-proxy 429 burst, extractor
master-budget timeout, evidence that built but yielded nothing) used to be written
to the cache like any other run. Because the read path served any row <24h old
regardless of quality, every subsequent retry replayed the empty payload WITHOUT
re-scraping — the site appears to "never even try to scrape" again until the row
ages out. User-visible symptom: "We couldn't detect your site's colors" /
"No changes could be confidently extracted" on a site that scrapes fine on a
forced fresh run.

**Rule:** never cache or serve a payload where EVERY dimension `status === "failed"`.
Guard both the read (fall through to a fresh scrape) and the write (skip
`putCached`) with `payloadHasUsableResults` (at least one dimension not failed).

**Why:** caching a transient total failure blocks re-scraping for the full TTL,
and the underlying scrape (Firecrawl) is usually fine on the next attempt.

**How to apply:** the threshold is "at least one dimension succeeded," NOT
"colors succeeded" — requiring colors would force expensive re-scrapes whenever a
site legitimately has no detectable colors but other dimensions are valid. If a
future need arises to retry specifically on missing colors, use a short TTL gated
on `colors.status === "failed"` rather than making colors mandatory for caching.
Legitimately-partial results (some dims ok) are still cached intentionally.
