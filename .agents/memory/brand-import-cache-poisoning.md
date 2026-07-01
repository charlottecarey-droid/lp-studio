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

## Partial-success gap → image recovery must BYPASS the cache

Because "at least one dimension succeeded" is the caching threshold, a run where
colors/voice succeed but **photography + homepage screenshot fail** (common when a
site blocks the scraper) is a legitimately-partial result and IS cached for the
full TTL — correctly, per the rule above. Consequence: a plain re-import will
"just auto-show everything already imported" and NEVER re-attempt the missing
images until the row ages out.

**Rule:** recovering missing images/screenshots must never go through the normal
cached import path. Two supported ways to force a fresh scrape:
- Pass `forceRefresh: true` end-to-end (the flag was plumbed backend long before
  the frontend sent it — a manual "re-import" button MUST set it or it no-ops).
- Use a dedicated image-only route that calls `buildEvidence` +
  `extractPhotography` + `mirrorBrandAssets`/`mirrorHomepageScreenshot` directly
  and never reads/writes the orchestrator cache.

**Why:** the cache is doing its job; the empty photos are a real (cached) outcome,
not a cache bug. The fix is an explicit fresh path, not loosening the guard.

**How to apply:** an image-only fresh path should NOT write BrandConfig — merge
results into the unsaved config client-side and let the user Save, so a failed
scrape can't clobber good saved imagery. No guarantee of success: sites that block
the scraper (procore.com hit this) may still return zero — the feature enables a
retry, it doesn't defeat anti-scraping.
