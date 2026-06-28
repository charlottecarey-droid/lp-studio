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

**How to apply:** `NAV_TYPES`/`SELF_NAV_TYPES`/`stripRedundantLeadingNav` now
live in the lightweight shared module `artifacts/api-server/src/lib/nav-dedup.ts`
(generate-page + generate-microsite import from there; the migration boot path
imports it too WITHOUT dragging in the heavy route/AI module). They are called on
BOTH generation paths AND at SEED TIME: the `migrate.ts` global-template seed loop
runs the strip over a shallow copy of each template's blocks before insert, so
seeded rows never bake in `[nav, self-nav-hero]`. Re-applying to existing rows is
gated on bumping the seed marker (`global_templates_seed_vNN`) so the ON CONFLICT
overwrites `blocks`. If you add a new generation path or a new hero that renders
its own nav, call the strip there and add the hero type to `SELF_NAV_TYPES`
(don't blanket-add every hero — only ones with an unconditional internal nav;
`magazine-hero` is intentionally NOT self-nav). Seed-lineup contract is pinned in
`seeds/globalTemplates.intent.test.ts` ("never ship a double navbar"). Fixing the
code/seed only affects NEW generations and freshly-seeded rows; already-published
tenant pages keep the bad lineup baked into their saved blocks.
