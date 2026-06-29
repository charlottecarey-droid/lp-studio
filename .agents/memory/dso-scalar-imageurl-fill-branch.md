---
name: DSO scalar imageUrl has its own fillEmptyImages branch
description: Why dso-* single-image blocks (ai-feature etc.) DO get deterministic library fill even though the standard scalar branch excludes dso-
---

`fillEmptyImages` in `generate-page.ts` fills a block's scalar `imageUrl` through TWO mutually-exclusive branches:

- the STANDARD branch is gated `!blockType.startsWith("dso-")` — covers quote-with-image, cta-split-image, etc.
- a DEDICATED `blockType.startsWith("dso-")` branch fills dso-* single-image blocks (ai-feature, particle-mesh, flow-canvas, cta-capture) with an `lp-feature` library image (`lp-hero` for dso-heartland-hero / dso-scroll-story-hero).

**Why:** The `!startsWith("dso-")` exclusion on the standard branch *looks* like dso-* scalar images are never library-filled — a recurring code-review false-positive. They ARE filled, just by the dedicated dso- branch. So exposing a dso-* single-image block (e.g. dso-ai-feature) on the freeform/general path needs NO new image-fill callsite, and the visual fills deterministically from the library even when AI image generation is unavailable.

**How to apply:** When graduating a microsite-only dso-* block with a scalar `imageUrl` to the freeform path, confirm the dedicated dso- branch covers it (it covers ALL dso-* by prefix) instead of adding a generic fill. To expose the block itself for parity: add a NEUTRAL schema bullet to a `GENERAL_EXTRA_*` array + inject it in `buildGeneralSystemPrompt`, and wire it into `FREEFORM_RECIPES` as ` OR ` alternatives (uppercase, case-sensitive split).
