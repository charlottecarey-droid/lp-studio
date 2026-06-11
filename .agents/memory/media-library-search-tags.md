---
name: Media library search must match tags, not just title
description: Why image-library search returned nothing for tagged product images, and the fix
---

The image library search endpoint (`GET /lp/media/images` in api-server `storage.ts`)
historically filtered the `q` query with `ilike(title, %q%)` ONLY — it never searched
the `tags` jsonb array.

**Symptom:** users search "crown"/"aligner"/"implant" in the Media Library drawer and get
nothing back, even though many images are correctly tagged — because uploaded/scraped
product images carry hash-y or generic titles ("ffe25bcc…", "Image@2x") and the real
subject lives only in `tags`. On staging tenant 1 the gap was huge: title-only "crown" = 14
rows vs title+tags = 241; "implant" 6 → 26; "denture" 21 → 73.

**Fix:** OR the title match with an EXISTS over `jsonb_array_elements_text(tags)` ILIKE the
same `%q%`. The `tag`/`onlyTag`/`excludeTag` params are exact `@>` containment and are a
separate concern (sidebar chips) — the free-text `q` box is the one that needs the tag OR.

**Why:** the picker/scorer path (`fetchMediaCatalog` + `scoreImage`) already reads tags, so
only the human search box was blind; the tags are the canonical subject signal for
hash-titled assets.

**How to apply:** any free-text search over `lp_media` (or similar tag-bearing asset tables)
must search tags in addition to title, or hash-titled rows are invisible. Frontend
(`MediaLibraryDrawer.tsx`) already sends `q` and renders server rows directly — no
client-side title filter to worry about.
