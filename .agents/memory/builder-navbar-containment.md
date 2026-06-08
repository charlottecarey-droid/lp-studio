---
name: Builder navbar containment
description: How sticky/fixed navbars are kept inside the page-builder canvas (two-pronged: per-block isBuilder + CSS catch-all).
---

Page-level navbar/header blocks must NOT pin over the builder toolbar/chrome
while editing, but MUST keep their sticky/fixed behaviour on the published page.

**Two-pronged solution (keep both in sync):**
1. Per-block `isBuilder` prop: navbar blocks render `relative z-auto` in the
   builder and `sticky top-0 z-50` (or `fixed`) otherwise. Blocks following this:
   BlockStickyHeader, BlockStickyBar, BlockNavHeader, BlockDsoPracticeNav,
   BlockFullBleedHero (inner header), BlockParallaxLayersHero (inner nav).
   Thread `isBuilder={isBuilder}` at the matching BlockRenderer callsite.
2. CSS catch-all in index.css: the builder canvas carries `data-lp-builder`
   (the viewer wrapper has only `data-lp-page`). Rule:
   `[data-lp-builder] { contain: layout; isolation: isolate; }`.
   `contain: layout` makes the canvas the containing block for descendant
   `position: fixed` (reparented + clipped by the canvas's overflow:hidden);
   `isolation: isolate` caps descendant z-index below the editor chrome.

**Why:** new templates can ship a sticky/fixed navbar that forgets the per-block
`isBuilder` handling; the CSS catch-all contains `fixed` regardless, so the
toolbar/Publish stays clickable without per-block follow-up.

**How to apply / gotchas:**
- `contain: layout` deliberately does NOT neutralize `position: sticky`. It does
  not create a scroll container, so legitimate in-block scroll-effect panels
  (scroll-story, vertical-tabs, switchback, sticky-stack, horizontal-showcase)
  keep working in the builder. Do NOT use `transform`/`filter` on the canvas —
  those reparent AND break sticky inside child blocks.
- BlockStickyStack is a scroll-effect (sticky card deck), NOT a navbar — leave
  its positioning alone; it uses no `fixed` and never overlaps the toolbar.
- Published/preview path is unchanged because it never sets `isBuilder` for these
  blocks and the wrapper has no `data-lp-builder`.
