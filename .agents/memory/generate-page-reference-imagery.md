---
name: AI page-gen reference imagery (scrape → mirror → fill)
description: Why scraped source-URL images silently vanish from AI-generated pages and how the harvest/dedup/fill pipeline must behave.
---

# AI page-gen reference imagery

When `/api/lp/generate-page` is given `referenceUrls`, it scrapes each page, then
`mirrorReferenceImages` (assets-uploader.ts) downloads the candidate images into
`lp_media` tagged `["page-reference","scraped","refhost:…","refsrc:<hash>"]`. The
returned `images[]` are appended (after the drawer catalog) to the fill pool so
empty image slots can use the source's own photos.

## Rule: dedup must RETURN existing rows, not an empty array
`mirrorReferenceImages` dedups candidates whose `refsrc:` tag already exists on a
prior `scraped` row. The original code returned `images: []` whenever every
candidate was already mirrored (i.e. on the **second+** generation from the same
URL). Result: repeat generations got zero reference images and silently fell back
to generic catalog photos — the "didn't use the source pictures" bug.

**Fix/contract:** the dedup lookup builds a `Map<refsrcTag, MirroredImage>` and
pushes the *existing* library rows for deduped candidates into `out.images`
(capped at `MAX_REFERENCE_PHOTOS=6`, matching the fresh-upload path). So every
generation from a URL surfaces that URL's imagery, not just the first.

**Why:** scraped rows live in the catalog forever; `attempted=0 deduped=N` in
logs is NORMAL on repeat runs and must NOT mean "no reference images this run".

## Grace window races the mirror under pool contention
The post-LLM fill waits `SCRAPED_MEDIA_GRACE_MS` for the background mirror. The
mirror runs concurrently with the 30–70s LLM call, so it's usually done — UNLESS
the Neon pool (max 10) is saturated and the mirror's `lp_media` inserts queue
behind a connection timeout. Window bumped 4s→8s for that case. Log
"harvest not ready within grace window" = pool contention, not a code bug.

## Stale cross-host scrapes win score-0 ties → fill-pool must be host-ordered
Scraped rows are untagged-for-purpose so every one scores 0 in `findBestImage`,
which keeps the FIRST max-scorer on ties. A tenant accumulates scraped images
from many prior reference URLs (apple.com, usatoday.com, …); when the fill pool
was `[...catalog(newest-first), ...freshScraped]`, an older apple.com row sitting
earlier beat the clay.com row the user actually referenced. Symptom: "it used a
random Apple image instead of the reference site's photos."

**Fix/contract:** `buildReferenceFillPool(catalogImages, freshScrapedMedia,
referenceUrls)` (exported, unit-tested) partitions the pool: curated (non-scraped)
→ freshScraped (this run) → current-reference scraped (refhost matches a current
reference host) → other-host scraped. Host compare normalizes BOTH sides (strip
`www.`, lowercase) — `refHostOf` must stay in sync with how `currentRefHosts` is
derived. `fetchMediaCatalog` also drops `scraped` rows from the model's IMAGE
LIBRARY `catalogText` (so the LLM can't pick a stale scrape by URL) while keeping
them in returned `images` for server-side fill.

**Why:** the model can't reliably distinguish stale vs current scrapes from a flat
catalog, and the deterministic fill tiebreak is order-sensitive — so freshness/host
priority must be enforced in pool ORDER, not left to scoring.
