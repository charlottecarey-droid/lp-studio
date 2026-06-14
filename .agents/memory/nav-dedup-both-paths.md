---
name: Nav-dedup strip must run on both generate-page paths
description: Why template-generated pages shipped two stacked navbars
---

`artifacts/api-server/src/routes/lp/generate-page.ts` has a nav-dedup strip
(`stripRedundantLeadingNav`) that drops a standalone nav block (`NAV_TYPES`)
sitting directly before a self-nav hero (`SELF_NAV_TYPES`) at the top of a page,
so a page never ships two stacked navbars.

**Why:** the classic `hero` block (and the other SELF_NAV_TYPES heroes) renders
its OWN unconditional `<nav>`. A lineup `[nav-header, hero, …]` therefore stacks
two navbars. The strip originally lived only on the freeform generation path;
the TEMPLATE path returns earlier and never reached it, so template-seeded pages
(e.g. the "Feature Deep Dive" global template, block ids
`seed-global-feature-deep-dive-*`) shipped duplicate navs (observed on the
published `dandy-dentures` page).

**How to apply:** `NAV_TYPES`/`SELF_NAV_TYPES`/`stripRedundantLeadingNav` are
module-scope now and called on BOTH paths. If you add a new generation path or a
new hero that renders its own nav, call the strip there and add the hero type to
`SELF_NAV_TYPES` (don't blanket-add every hero — only ones with an
unconditional internal nav). Fixing the code only affects NEW generations;
already-published pages keep the bad lineup baked into their saved blocks.
