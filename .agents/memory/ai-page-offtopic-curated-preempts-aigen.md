---
name: AI-page off-topic curated pre-empts AI gen
description: Why an AI-generated page placed off-topic library photos under confident captions, and the fill-ordering rule that fixes it.
---

# AI-page off-topic curated image fill must not pre-empt AI generation

**Symptom:** an AI-*generated* (not URL-import) landing page on a tenant with a
large but topically-diverse library (e.g. Dandy's ~900-image catalog) ships
"super random" images, and the AI-authored alt/caption makes a clearly-wrong
photo look intentional — a "machining / manufacturing" lab shot under a gallery
caption that reads "Dentist scanning patient", a factory photo on a benefit row,
a portrait under "Dentures ready for delivery".

**Root cause:** the AI image-gen branch in `generate-page.ts` ran a **relaxed
CURATED `fillEmptyImages` pass BEFORE `aiFillEmptyImages`**. `findBestImage`'s
`lp-feature` relevance gate (rejects a curated photo whose auto-tagger DESCRIBED
a subject — `hasTopicalTag` — yet scores ZERO topical relevance for the slot) is
disabled when `relaxed=true`. So that pre-AI pass placed off-topic-but-described
library photos into feature/gallery slots, pre-empting an on-topic AI image and
leaving the model's confident caption glued to a wrong photo.

**Rule:** do NOT run a relaxed curated fill before AI generation. The STRICT
pass already places every topically-relevant curated image (gate only rejects
`contentScore <= 0` described photos). Off-topic curated/scraped/starter images
must fill ONLY in the final last-resort `fillEmptyImages(..., relaxed=true)`
pass that runs AFTER `aiFillEmptyImages` — which is exactly what `findBestImage`'s
own comment already documents ("Rejected images still fill in the relaxed
last-resort pass, which runs AFTER AI image generation").

**Why:** for a rich, diverse library "any real brand photo beats an AI image"
becomes "an unrelated lab/factory/portrait photo beats a relevant AI image".
Relevance must win over provenance for content slots; an honest AI-generated (or
empty) slot beats a wrong photo wearing a true-sounding caption.

**How to apply:** the only effect of that removed pass was placing off-topic
described curated images (strict already exhausted relevant ones), so removing it
loses nothing relevant. Affects AI-gen-enabled tenants only (the pass was inside
the `outsideBuilderOn || imageGenStatus.enabled` gate). Non-AI-gen tenants are
unchanged — their off-topic curated images already filled only in the last-resort
pass. Residual: if AI-gen is disabled or fails, the last-resort pass can still
place an off-topic image under a specific caption (empty-vs-wrong-caption
tradeoff left intact to avoid re-introducing shipped-empty slots).
