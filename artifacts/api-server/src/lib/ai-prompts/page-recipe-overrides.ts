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

/** Parse a jsonb skeleton column into a clean string[] (or null). Defensive:
 *  pg returns jsonb already parsed, but a hand-edited / legacy value could be a
 *  JSON string or a non-array — never let that throw. */
function parseSkeleton(raw: unknown): string[] | null {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(value)) return null;
  const cleaned = value
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter((s) => s.length > 0);
  return cleaned.length > 0 ? cleaned : null;
}

/** Read the override rows for one prompt path, ordered so custom recipes append
 *  deterministically (sort_order then created_at). Fail-open: [] on error. */
export async function loadRecipeOverrides(
  path: RecipePromptPath,
): Promise<RecipeOverride[]> {
  try {
    const result = await pool.query(
      `SELECT recipe_id, label, description, style_notes, skeleton, is_custom,
              sort_order, enabled
         FROM page_recipe_overrides
        WHERE recipe_path = $1
        ORDER BY sort_order ASC, created_at ASC`,
      [path],
    );
    return result.rows.map((r: any) => ({
      recipeId: String(r.recipe_id),
      label: r.label ?? null,
      description: r.description ?? null,
      styleNotes: r.style_notes ?? null,
      skeleton: parseSkeleton(r.skeleton),
      // Treat anything but an explicit false as enabled (defensive).
      enabled: r.enabled !== false,
      isCustom: r.is_custom === true,
      sortOrder: Number.isFinite(Number(r.sort_order)) ? Number(r.sort_order) : 0,
    }));
  } catch (err) {
    console.error("[page-recipe-overrides] load error:", err);
    return [];
  }
}

/**
 * The EFFECTIVE recipe pool for a prompt path: code (built-in) recipes with any
 * superadmin overrides applied (wording, section skeleton, on/off) plus the
 * superadmin's enabled custom recipes appended. Fail-open to the raw code
 * recipes — the caller's existing empty-pool handling covers the (rare)
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
