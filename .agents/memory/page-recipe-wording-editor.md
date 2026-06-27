---
name: Page-recipe wording editor + skeleton OR-case gotcha
description: How the superadmin recipe editor is scoped (wording-only) and why skeleton OR-alternatives must be uppercase
---

The superadmin "Page Recipes" editor (SuperAdminRecipes.tsx, tab in SuperAdminPage.tsx) is **wording-only**: it edits a recipe's label / description / styleNotes and an on/off toggle. The section SKELETON (block order) is ALWAYS code-defined in `page-recipes.ts` and is shown read-only.

Shadow-override plumbing: `page_recipe_overrides` (composite PK recipe_path+recipe_id, nullable wording cols, enabled NOT NULL default true) ← `page-recipe-overrides.ts` `loadEffectiveRecipesForPath()` (fail-open to code recipes) ← consumed by generate-page's `recipePool`. DELETE row = reset to code default; absent row = code default, enabled; `enabled=false` drops the recipe from rotation. All-disabled is safe: empty pool → no recipe directive (same as pre-recipe behavior), generation still works.

**Skeleton OR-case rule:** `recipeSkeletonBlockTypes` splits skeleton entries on **case-sensitive** `/\s+OR\s+/`. An "a OR b" alternative MUST use uppercase ` OR `.

**Why:** a lowercase "a or b" entry is NOT split, so the whole space-containing string survives as one "block type" and fails the recipe-vocab test's `/^[a-z0-9-]+$/` assertion (generate-page.recipe-vocab.test.ts) — a confusing failure far from the edit.

**How to apply:** when hand-editing `skeleton:` arrays in page-recipes.ts, only ever use uppercase ` OR ` between alternatives; run page-recipes.test.ts + recipe-vocab.test.ts after.
