/**
 * DB read layer for the superadmin recipe WORDING overrides (June 2026).
 *
 * The recipes themselves live in page-recipes.ts (code = source of truth +
 * fallback). This module reads the optional per-recipe overrides from
 * page_recipe_overrides and merges them onto the code recipes so generate-page
 * can rotate over the EFFECTIVE pool (overridden wording, disabled recipes
 * dropped).
 *
 * FAIL-OPEN: every DB error returns the code defaults so page generation is
 * never broken by a missing table, a transient DB blip, etc.
 */
import { pool } from "@workspace/db";
import {
  recipesForPath,
  mergeRecipeOverrides,
  type PageRecipe,
  type RecipeOverride,
  type RecipePromptPath,
} from "./page-recipes";

/** Read the override rows for one prompt path. Fail-open: returns [] on error. */
export async function loadRecipeOverrides(
  path: RecipePromptPath,
): Promise<RecipeOverride[]> {
  try {
    const result = await pool.query(
      `SELECT recipe_id, label, description, style_notes, enabled
         FROM page_recipe_overrides
        WHERE recipe_path = $1`,
      [path],
    );
    return result.rows.map((r: any) => ({
      recipeId: String(r.recipe_id),
      label: r.label ?? null,
      description: r.description ?? null,
      styleNotes: r.style_notes ?? null,
      // Treat anything but an explicit false as enabled (defensive).
      enabled: r.enabled !== false,
    }));
  } catch (err) {
    console.error("[page-recipe-overrides] load error:", err);
    return [];
  }
}

/**
 * The EFFECTIVE recipe pool for a prompt path: code recipes with any superadmin
 * wording overrides applied and disabled recipes dropped. Fail-open to the raw
 * code recipes — the caller's existing empty-pool handling covers the (rare)
 * all-disabled case.
 */
export async function loadEffectiveRecipesForPath(
  path: RecipePromptPath,
): Promise<PageRecipe[]> {
  const base = recipesForPath(path);
  const overrides = await loadRecipeOverrides(path);
  if (overrides.length === 0) return [...base];
  return mergeRecipeOverrides(base, overrides);
}
