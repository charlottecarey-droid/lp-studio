---
name: Reference-image supply caps
description: The two compounding caps that bound how many distinct brand photos a page-create scrape can mirror, and why raising them is safe for Brand Import.
---

# Page-create reference image supply

AI page generation harvests real site photos at create time (`mirrorReferenceImages` in `assets-uploader.ts`), mirrors them into `lp_media` tagged `scraped`, and feeds them into the fill pool. For image-poor brands the generator runs out of distinct on-brand photos and falls back to neutral/AI fillers.

The distinct supply is bounded at **two compounding stages**:
1. **Per-page DOM cap** — `MAX_CONTENT_IMAGES` in `extractors/photography.ts` (`collectImagesFromDom`/`pickImagesFromDom`). Caps how many content `<img>`/srcset/CSS-bg images each scraped page yields.
2. **Mirror cap** — `MAX_REFERENCE_PHOTOS` in `assets-uploader.ts`. Caps how many distinct images actually get mirrored per generation.

The multi-page reference scrape (`maybeMultiPageScrapeRef`) already aggregates + dedups image URLs across the homepage + companion paths, so for a root-URL reference the per-page cap is rarely the binding constraint — the mirror cap is. To widen distinct supply, both should rise together.

**Why raising the DOM cap is safe for Brand Import:** its downstream mirror (`MAX_PHOTOS`) and vision sampler (`visionTargets.slice(0,6)`) both cap at 6 and read the first-N in document order, so extra candidates change nothing there — they only widen the page-create harvest pool.

**Dedup is independent of supply:** near-duplicate variants (resize/srcset/cache-buster) are folded by `imageIdentity` (scraped rows fold via refhost + title stem) at selection time, so raising caps never reintroduces duplicate placements.

**Genuinely image-poor sites** (very few *total* distinct photos, the original Dandy SMB case) are NOT solved by higher caps alone — they need more source pages (extra companion paths, cost) or brand-appropriate stock sourcing.
