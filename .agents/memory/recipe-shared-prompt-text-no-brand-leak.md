---
name: Recipe description/styleNotes are shared-prompt text
description: Why DSO page-recipe description/styleNotes must stay brand-neutral
---

DSO page recipes in `page-recipes.ts` (DSO_RECIPES) are selected for Dandy AND every dental-industry tenant — `dsoEligible = isDandyTenant || getTenantIndustry === "dental"`. A recipe's `description` and `styleNotes` are injected verbatim into the AI system prompt (via buildRecipeDirective / injectRecipeIntoBlockSelection).

**Rule:** never put a tenant-specific brand reference (e.g. "modeled on Dandy's flagship page") in a shared recipe's `description` or `styleNotes`. Keep them brand-neutral; structural/layout guidance only.

**Why:** architect flagged a "modeled on Dandy's flagship DSO partner page" description as a scope leak — non-Dandy dental tenants would get Dandy-referential prompt text despite the DSO prompt's anti-leak rules. Brand-specific wording belongs only in `isDandyTenant`-gated prompt sections (e.g. dandyTerminologySection), not in recipe data.

**How to apply:** when editing DSO_RECIPES skeleton/description/styleNotes, describe the layout and tone generically; let the isDandyTenant gating supply the brand voice.
