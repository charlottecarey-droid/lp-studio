---
name: generate-page scrape gating
description: when LP page generation is allowed to scrape/mirror a reference site
---

At generate-page time there are TWO scrape tiers (June 2026):

1. **Per-request URLs** (`perRequestUrls` = request `referenceUrls` + legacy
   `referenceUrl`) — the URLs the user pasted into the generate modal. FULL
   treatment: multi-page markdown, screenshot for vision, image harvest
   mirrored into `lp_media`, and (alone) eligibility for the strict-facts
   trust gate (`urlSourcedFacts` matches on `perRequestUrlSet` ONLY).

2. **Brand `inspirationUrls`** (persisted in Brand Settings) — scraped again,
   but ONLY via the cached SCRAPE-ONLY path `scrapeInspirationUrl` in
   routes/lp/firecrawl.ts: single page, no screenshot, harvested image URLs
   dropped (so `mirrorReferenceImages` is NEVER fed by them), markdown capped
   at 8k, results cached in a module-level TtlCache (24h, ≤100 entries, LRU).
   Surfaced to the model as a "BRAND INSPIRATION SITES — STYLE & STRUCTURE
   REFERENCES ONLY" section, and echoed in the response as the additive
   `inspirationReferences: [{url, fromCache}]` field.

**Why two tiers:** the old code merged both lists into one set and gave it the
full treatment on EVERY generation — each run re-mirrored the same homepage
images into `lp_media`, flooding the library with duplicate "scraped" rows.
The later over-correction (not scraping inspiration at all) starved the
"REFERENCE PAGE" prompt signal and pages stopped looking like the brand's
reference sites. The scrape-only cached tier restores the style signal without
the mirroring or trust side effects.

**Caps:** total reference fan-out ≤ MAX_SCRAPE_URLS (5); per-request URLs
count toward the cap first, inspiration fills the headroom up to
INSPIRATION_REFERENCE_MAX_SITES (2). URLs in both lists dedupe INTO the
per-request set (`selectInspirationScrapeUrls` in generate-page.ts).

The brand-import flow is a SEPARATE endpoint and still scrapes the homepage on
demand — don't touch it. Regression coverage:
generate-page.scrape-gating.test.ts (route gating + response echo),
firecrawl.test.ts (inspiration cache / scrape-only contract),
generate-page.inspirationSection.test.ts (prompt section + scrape-set caps).
