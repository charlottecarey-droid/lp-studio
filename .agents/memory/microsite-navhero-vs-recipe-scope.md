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

**Hero sets vs nav-recognition sets — keep them DECOUPLED:**
- `MICROSITE_SELF_NAV_HERO_TYPES` (includes the neutral `hero`) → heroes that
  bake their own top nav.
- `MICROSITE_DARK_BY_DESIGN_HERO_TYPES` (DSO heroes only, NOT `hero`) → the
  white-hero upgrade pass skips these. The neutral `hero` stays OUT so a plain
  white text-only hero still gets upgraded.
- `MICROSITE_HERO_BLOCK_TYPES` = the two above unioned → drives the
  hero-UPGRADE pass (`upgradeMicrositeHero` findIndex) and the anchor-skip.
- `MICROSITE_NAV_PRESENT_TYPES` + `MICROSITE_SELF_NAV_PRESENT_TYPES` (the latter
  = SELF_NAV_HERO ∪ generate-page's general `SELF_NAV_TYPES`) → drive ONLY
  nav-DEDUP (strip a redundant standalone nav before a self-nav hero; treat a
  self-nav hero as "nav already present" so none is prepended).

**Why the PRESENT sets are separate from the HERO sets:** nav-dedup must
recognize a WIDE range of nav-bearing / self-nav blocks (now that microsites use
the full general vocab), but the hero-UPGRADE pass must NOT see those extra types
as heroes. Widening nav recognition through the PRESENT sets keeps the
hero-upgrade pass (driven by `MICROSITE_HERO_BLOCK_TYPES`) untouched, so a
brand-new general hero type never accidentally enters the white-hero upgrade.

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

## Freeform microsite vocabulary = GENERAL landing-page set ∪ extras

The neutral-freeform microsite vocabulary is NOT a hand-curated short list — it
EQUALS the general landing-page system prompt's advertised block set UNION the
microsite-only extras (currently `stats`, `rich-text`, `footer`). One source of
truth: `micrositeFreeformVocab()` in `recipe-block-vocab.ts` (parses the general
prompt via `parsePromptBlocks`, then appends the extras from
`FREEFORM_MICROSITE_DISPLAY_TYPES` that the general set lacks). BOTH the generator
(guide + `FREEFORM_ALLOWED_TYPE_SET`) and the superadmin recipe builder
(`availableBlocksForPath("microsite")`) read it, so the menu and what actually
generates stay identical.

**Consequence (intentional, user-confirmed):** microsites DO offer the premium
`dso-*` blocks the general prompt advertises (e.g. `dso-heartland-hero`) — keep
them. The only blocks dropped from freeform microsites are the ones the general
prompt itself does NOT advertise: gated self-contained full-page blocks
(content-series / storefront / webinar-hub / blog-series) and `business-case-*`.

**Trap:** never write `dso-*/business-case-*` literally inside a `/* */` JSDoc
block — the `*/` closes the comment early (esbuild "Unexpected" parse error).
Write `dso-` / `business-case-` or use `//` line comments.

**Why:** the goal was "microsites offer the SAME blocks as landing pages." A
separate curated microsite list silently diverged from the landing-page set as
new blocks were added; deriving from the general prompt guarantees parity forever.
