---
name: Microsite nav/hero enforcement vs recipe-variety scope
description: Which microsite generation paths the post-gen nav/hero passes touch vs which path the layout-recipe variety is limited to, and the two separate hero sets.
---

# Microsite nav/hero enforcement vs recipe-variety scope

Two related but DIFFERENTLY-scoped behaviors in `generate-microsite.ts`:

1. **Post-generation chrome enforcement** — `ensureMicrositeNavbar` +
   `upgradeMicrositeHero` run for **ALL non-template, non-outline** microsite
   paths: neutral-freeform, DSO-freeform, AND segment-pool. The call-site gate is
   `isFreeformMicrosite = !templateBlocks` plus `!outlineActive` (NOT
   `useFreeform`), so it deliberately spans those three paths.

2. **Layout VARIETY (page recipes)** — the ONLY thing scoped to neutral-freeform.
   It lives in `buildSystemPrompt`'s `if (useFreeform && !hasOutlineFixedList)`
   branch; the `dsoFreeformMode` and `usePoolFreeform` branches `return` BEFORE
   it, and template/outline never enter the freeform branch. So a `micrositeRecipe`
   can only ever reach the neutral-freeform prompt.

**Two separate hero sets — never re-couple them:**
- `MICROSITE_SELF_NAV_HERO_TYPES` (includes the neutral `hero`) → drives nav
  de-duplication (treats `hero` as self-nav so no second nav-header is prepended
  and a redundant standalone nav before it is stripped).
- `MICROSITE_DARK_BY_DESIGN_HERO_TYPES` (DSO heroes only, NOT `hero`) → the
  white-hero upgrade pass skips these. The neutral `hero` stays OUT so a plain
  white text-only hero still gets upgraded.

**Why:** the neutral `hero` block bakes its OWN top nav, so a prepended/leading
nav-header ALWAYS stacks two navbars — a universal render defect of that block.
De-duping it on segment-pool/DSO too is intentional: block SELECTION on those
paths is unchanged, only a duplicate navbar is removed. A stacked second navbar
is never a desired design.

**How to apply:** changing nav/hero enforcement affects 3 paths — verify
segment-pool + DSO, not just neutral-freeform. Changing recipe/variety is
neutral-freeform only. To prove recipe scoping, unit-test `buildSystemPrompt`
across `useFreeform` / `usePoolFreeform` / `dsoFreeformMode` / outline-fixed-list
/ template (see `generate-microsite.recipeScope.test.ts`).
