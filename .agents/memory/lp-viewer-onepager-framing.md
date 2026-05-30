---
name: One-pager vs landing-page rendering in landing-page-viewer
description: Sales one-pagers and landing pages share the same viewer; how to tell them apart and the two render paths that must stay in sync.
---

Sales one-pagers (e.g. partners.meetdandy.com/onepager-*) are NOT a separate page type — they render through the same `landing-page-viewer.tsx` block pipeline as ordinary landing pages. The ONLY runtime signal that a builder page is a one-pager is the presence of a block with `type === "one-pager-hero"` (`hasOnePagerBlock`). There is no page/template metadata flag for "is one-pager".

**Why it matters:** one-pagers must read like a contained printed sheet (centered fixed max-width, neutral backdrop) instead of full-bleed wide-screen landing pages. The shared `OnePagerFrame` wrapper applies that sheet ONLY when `hasOnePagerBlock` is true; otherwise it is a transparent passthrough so landing pages are byte-for-byte unchanged.

**Two parallel block-render paths must be kept in sync.** `landing-page-viewer.tsx` renders builder blocks in TWO places: the `isBuilderPageResponse` direct-builder-page path AND the `linkedPage` (variant-with-linked-page) path. Any cross-cutting change to how blocks are framed/wrapped (e.g. one-pager sheet, global padding, max-width) must be applied to BOTH or one entry point silently diverges.

**Full-bleed block gotcha:** the one-pager hero is full-bleed (`width:100%`) and has FIXED internal text padding; the generic per-block `paddingX` setting (BlockRenderer `wrapWithSettings`) is applied as OUTER gutters, so using it on the hero creates margins around the green band, not text inset. Don't reach for `paddingX` to inset hero text. Avoid `overflow-hidden` on any one-pager frame wrapper — blocks may use `position:sticky` internally and an overflow ancestor breaks it.
