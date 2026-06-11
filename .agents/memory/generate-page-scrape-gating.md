---
name: generate-page scrape gating
description: when LP page generation is allowed to scrape/mirror a reference site
---

At generate-page time, scrape ONLY the URL(s) the user pastes into the generate
modal's URL box (`perRequestUrls` = request `referenceUrls` + legacy
`referenceUrl`). The brand's persisted `inspirationUrls` (e.g. the Brand Settings
homepage) must NOT feed the scrape set.

**Why:** the old code merged `perRequestUrls + brand.inspirationUrls` into one
`mergedReferenceUrls` set and scraped it on EVERY generation. Each run re-scraped
the homepage and `mirrorReferenceImages` re-mirrored the same photos into
`lp_media` (tagged `scraped`), so the media library steadily filled with duplicate
random "scraped" rows. Brand voice/structure is already injected separately
(persisted), so re-scraping the homepage every run added no copy value — only
image bloat.

**How to apply:** the scrape set is `scrapeUrls = perRequestUrls`. `inspirationUrls`
is still computed and echoed in the response for telemetry, but never scraped here.
The brand-import flow is a SEPARATE endpoint and still scrapes the homepage on
demand — don't touch it. Both mirror callsites gate on
`scrapeResult.scraped?.imageUrls.length > 0`; the template-mode mirror (the
`replaceImagery === true` branch) additionally requires that flag, the freeform
mirror does not. Regression coverage: generate-page.scrape-gating.test.ts.
