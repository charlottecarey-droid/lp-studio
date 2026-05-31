---
name: LP Studio full-page block wiring
description: The non-obvious callsites required when adding a new "full-page" block (renders its own nav/hero/footer) to LP Studio; mirror content-series exactly.
---

A "full-page" LP Studio block (one block = the whole page: own nav, hero,
sections, footer — e.g. content-series, event-page, product-launch, story-hub,
blog-series, storefront) needs MORE wiring than an ordinary section block. Mirror
`content-series` at every callsite or you get silent partial breakage.

**Rule:** a new full-page block must be added to ALL of:
- `block-types/generic-blocks.ts` (prop interfaces) + `index.ts` barrel re-exports
- `block-registry.tsx` (defaults, type overloads, createBlock case, BLOCK_REGISTRY entry)
- `block-variant.ts` (union), `BlockRenderer.tsx` (render case), `PropertyPanel.tsx` (panel case)
- `lib/lp-template-engine/src/block-tags.ts` (role tags) — needs `tsc -b` in lib/lp-template-engine after
- **`BlockRenderer.tsx` `NO_REVEAL` set** ← easiest to miss
- api-server `generate-page.ts` `collectImageSlots` (AI image-fill) + flagship seed in `flagshipTemplates.ts`

**Why NO_REVEAL matters:** blocks NOT in `NO_REVEAL` get wrapped in a transformed
scroll-reveal `motion.div`. Full-page blocks have their own sticky navs /
scroll-progress / parallax internals; the transform wrapper breaks
`position:sticky` and shifts `getBoundingClientRect` measurements. Symptom: sticky
nav doesn't stick, scroll animations misfire — only on the viewer/published page
(`shouldReveal = animationsEnabled && !isBuilder && !NO_REVEAL.has(type)`), so the
builder looks fine and the bug hides until publish.

**AI freeform selection:** full-page blocks are NOT globally advertised to the
GENERAL page generator (they'd corrupt normal multi-block pages). They are
keyword-gated: add an `is<Block>Request(prompt)` detector + an `include<Block>`
flag to `buildGeneralSystemPrompt`, inject the schema bullet in the showcase
section, and pass the flag at the call site. Still respects `block_catalog`
`ai_enabled` filtering (fail-open: no row = advertised). `extractPromptBlockTypes`
parses allowed types from the prompt text itself, so no separate validation edit.

**How to apply:** when adding any full-page block, grep for `content-series`
across artifacts/lp-studio + artifacts/api-server and replicate every hit.
