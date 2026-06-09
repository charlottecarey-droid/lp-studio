---
name: How It Works Alternating real images
description: How a decorative-panel block was converted to real per-step images, and the full set of image-pipeline callsites that must be wired together.
---

Converting a "fake decorative CSS panel" block to real per-item images (e.g.
how-it-works-alternating steps[].image) requires coordinated edits or the slot
renders empty / never fills:

- Type: add the optional image field on the per-item interface.
- Renderer: render the real `<img>` with a neutral placeholder fallback (mirror
  BlockZigzagFeatures rows[].imageUrl: aspect-[4/3], object-cover, lazy).
- Property panel: add `ImagePicker` per item + seed the field in the add-item default.
- Block-registry defaultProps: seed the field (e.g. `image: ""`) on each default item.
- generate-page.ts image pipeline — FOUR callsites, all keyed/branched on the array:
  1. `collectImageSlots` (pushArrField) — dedupe, used-slot tracking, template restore.
  2. `fillEmptyImages` — library fill of EMPTY slots (explicit per-shape branch).
  3. `aiFillEmptyImages` — AI image-generation FALLBACK (separate slot enumerator,
     easy to miss; without it slots stay empty when the catalog has no match).
  4. `sanitizeAIImageUrls` — clean hallucinated URLs the model emits.
- AI prompt: add the field to the block's schema bullet + the IMAGES source rules.

**Why:** the four generate-page functions each enumerate image slots
independently; wiring only some of them leaves the new slot silently empty in
real generation. `aiFillEmptyImages` is the one most often forgotten.
