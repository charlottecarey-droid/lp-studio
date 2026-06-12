---
name: Scraped-tier starves a tenant's own product photos
description: Why on-topic library photos lose to weak curated images in generate-page image fill, and the data lever to fix it
---

# Scraped page-reference photos are deferred and lose to weak curated images

In `artifacts/api-server/src/routes/lp/generate-page.ts`, `findBestImage` sorts
candidates into three tiers picked in strict order: `best` (curated: drawer
uploads, brand-import, AI, plus `currentReference` scrapes) → `bestScraped`
(STALE scrapes, i.e. `isScrapedImage` && !currentReference) → `bestStarter`.

The STRICT pass (`relaxed=false`) **skips** stale scrapes and starters entirely
(`if (deferred && !relaxed) continue`). The relaxed pass only runs if the strict
pass returns "". The strict-pass acceptability floor is just `score >= 0`.

**Failure mode:** a tenant's own product photos that were harvested as
page-reference scrapes (tagged `scraped` + `page-reference` + `refhost:` +
`refsrc:`) are classed as STALE scrapes and deferred. Meanwhile a weak/off-topic
*curated* image that merely clears `score >= 0` (e.g. an untagged image at score
0, or one that coincidentally matched a context word like "precision") fills the
slot in the strict pass — so the relaxed pass never runs and the far-more-relevant
scraped photo never gets considered. Symptom: a denture product-grid shows a
machining photo / "og screenshot" / AI cover instead of the real denture photos
that exist in the library.

**Why:** the tier dominance was added deliberately (generic scrapes scoring the
purpose boost used to beat the tenant's own curated library — the "wrong/scraped
images instead of our own" regression). So it is correct that *generic* scrapes
defer; the gap is that a tenant's OWN canonical product imagery can end up in the
scrape tier just because it was harvested via brand-import page-reference.

**How to apply (data lever, low-risk):** these page-reference photos from the
tenant's OWN site are canonical product imagery and belong in the curated tier.
Promote them by removing ONLY the `scraped` tag (`tags = tags - 'scraped'`);
`isScrapedImage` keys solely on that tag. KEEP `refhost:`/`refsrc:` so a future
brand-import mirror recognises them and does not re-duplicate. They keep their
`product-detail` purpose, so they win product slots on the +8 purpose boost and
the per-card title match breaks ties to the right photo.

**Related tagging gap:** `og screenshot` rows are excluded from fill only via the
`og-image` tag in EXCLUDE_TAGS. A bare row with **empty tags** (title "og
screenshot" but `tags=[]`) escapes the filter and leaks into slots at score 0 —
re-tag it `og-image`.

**Code-level alternative (NOT done — higher risk):** raise the strict floor above
0, or let a stale scrape that is dramatically more relevant beat a marginal
curated pick. Touches the deliberately-tiered selection logic; needs full e2e +
visual regression before shipping.
