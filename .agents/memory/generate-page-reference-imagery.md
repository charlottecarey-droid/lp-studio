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

**How to apply:** EXCLUDE_TAGS (fetchMediaCatalog) does NOT exclude
`scraped`/`page-reference`, so mirrored images do enter the general catalog;
selection is by scoreImage (generic-titled scraped imgs score low). If scraped
images aren't being picked, check scoring/relevance, not catalog inclusion.
