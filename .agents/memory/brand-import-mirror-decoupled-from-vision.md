---
name: Brand-import asset mirror decoupled from vision
description: Why the lp_media mirror reads referenceImageUrls from the raw extractor result, not just flattened proposed.
---

The brand-import asset mirror (orchestrator `applyAssetMirror` → `mirrorBrandAssets`)
must collect candidate photo URLs from BOTH `proposed.photographyProfile.referenceImageUrls`
AND the raw `payload.results.photography.data.referenceImageUrls`, deduped.

**Why:** `flattenForProposed` only copies a dimension into `proposed` when its
status !== "failed". Photography vision classification fails often (gpt-4o-mini
can't fetch hotlink-protected CDN images, throttled screenshot hosts, etc.). If
the mirror only reads `proposed`, a failed-vision run mirrors zero images even
when the page yielded perfectly good `<img>` URLs — leaving `lp_media` empty,
which is the upstream cause of blank `<img src="">` on generated pages.

**How to apply:**
- The photography extractor must populate `referenceImageUrls` on EVERY return
  path (ok / partial / failed / no-images), and fall back to the homepage
  screenshot URL when the page yielded no `<img>` URLs. Never return `data:null`
  on vision failure if there are URLs to mirror.
- Generation reads `lp_media` via `fetchMediaCatalog` — NOT `proposed` — so the
  real win is rows in `lp_media`, regardless of what ends up in `proposed`.
- Empty-src `<img>` must never render: `InlineImage` is the chokepoint
  (returns null in live mode, placeholder in builder mode). The scheduled
  asset-health audit counts empty-src imgs separately from missing /assets/*
  objects — a page can be R2-"healthy" yet still ship blank images.
