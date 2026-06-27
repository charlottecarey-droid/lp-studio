---
name: Page-recipe builder + skeleton OR-case gotcha
description: How the superadmin recipe builder is scoped (full builder) and why skeleton OR-alternatives must be uppercase
---

The superadmin "Page Recipes" editor (SuperAdminRecipes.tsx, tab in SuperAdminPage.tsx) is a **full recipe builder**: it edits a recipe's label / description / styleNotes, an on/off toggle, AND the section SKELETON itself — reorder / swap / add / remove slots, where a slot may offer "either/or" alternatives. Superadmins can also CREATE custom recipes and DELETE the custom ones. (It used to be wording-only with a read-only skeleton; that is no longer true.)

Shadow-override plumbing: `page_recipe_overrides` (composite PK recipe_path+recipe_id; nullable wording cols; `enabled` NOT NULL default true; plus `skeleton jsonb` NULL, `is_custom` bool default false, `sort_order` int default 0) ← `page-recipe-overrides.ts` `loadEffectiveRecipesForPath()` (fail-open to code recipes) ← consumed by generate-page's `recipePool`.
- Built-in recipe: lives in code; DB stores only the override. NULL/empty skeleton = inherit the code order, non-null = replace it. DELETE row = reset to code default. `enabled=false` drops it from rotation. All-disabled is safe (empty pool → no directive, same as pre-recipe behavior).
- Custom recipe: `is_custom=true`, the row IS the recipe (label/desc/styleNotes/skeleton all REQUIRED), id `<path>-custom-<hex>`, appended after built-ins by sort_order then created_at. Malformed custom rows are defensively skipped at merge time.

**KEY: General offers the FULL advertised vocab, not the curated subset.** The block menu + save-time validation use `recipe-block-vocab.ts` `availableBlocksForPath(path)` / `validateSkeleton(path, …)`, parsed from `build*SystemPrompt` bullets (general = `buildGeneralSystemPrompt()` no opts; DSO/practices built with `{isDandyTenant:false}`). General is a STRICT SUPERSET of the built-in freeform skeleton set. DEVIATION (intentional): the hot loader does NOT vocab-filter — save-time `validateSkeleton` is the only guard; recipe is a soft suggestion (per-tenant ai_enabled stripping + "swap unknowns" directive handle the rest at generation).

**Skeleton OR-case rule:** `recipeSkeletonBlockTypes` / `skeletonBlockTypes` split skeleton entries on **case-sensitive** `/\s+OR\s+/`. An "a OR b" alternative MUST use uppercase ` OR `.
**Why:** a lowercase "a or b" entry is NOT split, so the whole space-containing string survives as one "block type" and fails the recipe-vocab test's `/^[a-z0-9-]+$/` assertion (generate-page.recipe-vocab.test.ts) — a confusing failure far from the edit. The builder UI always serializes uppercase ` OR `, so this only bites hand-edits of `page-recipes.ts`.
**How to apply:** when hand-editing `skeleton:` arrays in page-recipes.ts, only ever use uppercase ` OR ` between alternatives; run page-recipes.test.ts + recipe-block-vocab.test.ts + recipe-vocab.test.ts after.
