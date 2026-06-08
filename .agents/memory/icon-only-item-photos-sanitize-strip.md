---
name: Icon-only item photos must be stripped at sanitize layer
description: Why benefits-grid/features icon cards render as tiny images, and where the real chokepoint to strip AI-supplied per-item URLs is.
---

# Icon-only item photos (benefits-grid / features) strip at sanitize, not fill

`benefits-grid` and `features` (`ITEM_PHOTO_BLOCK_TYPES`) are ICON-ONLY by
default. Their renderer (e.g. `BlockBenefitsGrid.tsx` `hasImage = !!benefit.image`)
turns ANY truthy `items[].image` into a tiny photo card and demotes the Lucide
icon to a small badge. Symptom users report: "the icons are tiny random images"
and "the same image repeats across every block".

**Root cause:** prompt rule 10b hands the AI the real IMAGE LIBRARY URLs, and the
AI copies one into `items[].image` of these icon-only blocks. The server-side
`fillEmptyImages` / AI-gen gates only stop the SERVER from POPULATING empty item
slots — they do NOT strip a URL the AI already supplied.

**The rule:** the single chokepoint to strip AI-supplied per-item photos is
`sanitizeAIImageUrls` in `generate-page.ts`. It runs FIRST in both orchestration
paths. For icon-only item blocks, force `items[].image = ""` when
`ITEM_PHOTO_BLOCK_TYPES.has(blockType) && props.useItemPhotos !== true` — sitting
alongside the existing `STAT_BAR_BLOCK_TYPES` force-clear. The strict
`!== true` mirrors the fill gate (opt-in only; string `"true"` is safely treated
as off). The opt-in path still runs `cleanUrl()` so hallucinated non-library URLs
become "".

**Why:** the fill/AI-gen gates and `collectImageSlots` are about server FILLING;
AI-SUPPLIED URLs bypass them entirely. Any "icon field is rendering a photo" or
"per-item photo leaked into an icon-only block" bug must be fixed at the sanitize
layer, not by adding more fill gates.

**How to apply:** when adding a new icon-only item block type, add it to
`ITEM_PHOTO_BLOCK_TYPES` so sanitize strips AI photos by default; if it should
support real per-item photos, the block must set `useItemPhotos: true`.
`cases`-shaped blocks (success-stories) use the separate `props.cases` path and
are intentionally unaffected.
