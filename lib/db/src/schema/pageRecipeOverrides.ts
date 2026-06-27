import { pgTable, text, integer, boolean, timestamp, jsonb, primaryKey } from "drizzle-orm/pg-core";

/**
 * page_recipe_overrides — superadmin overrides for the AI page-generation
 * "recipes" (June 2026, page-variety workstream → full recipe BUILDER).
 *
 * The BUILT-IN recipes (their id, prompt path, and code skeleton) stay defined
 * in api-server/src/lib/ai-prompts/page-recipes.ts — that code is the fallback.
 * This table stores a superadmin's overrides of a built-in recipe (its WORDING,
 * its section SKELETON / block order, and an on/off flag) AND any CUSTOM recipes
 * the superadmin creates from scratch.
 *
 * SHADOW-OVERRIDE semantics for BUILT-IN recipes (is_custom=false):
 *   • No row for a (recipe_path, recipe_id) → pure code default, enabled.
 *   • A NULL label/description/style_notes column → inherit that field from code.
 *   • A NULL skeleton → inherit the code section order; a non-null skeleton
 *     (array of "type" / "type OR alt" slots) REPLACES the code order.
 *   • enabled=false → the recipe is dropped from the AI rotation pool.
 *   • DELETE the row → reset the recipe fully to its code default.
 *
 * CUSTOM recipes (is_custom=true): the row IS the recipe — label, description,
 * style_notes and skeleton are all required (non-null), there is no code
 * fallback. sort_order positions a custom recipe within its path's pool (custom
 * recipes are appended after the built-ins, ordered by sort_order then
 * created_at). enabled=false hides it; DELETE removes it entirely.
 *
 * The merge is applied at generation time by loadEffectiveRecipesForPath().
 *
 * recipe_path is one of the RecipePromptPath values ('freeform' | 'dso' |
 * 'dso-practices'); recipe_id is a PageRecipe.id (custom ids are generated
 * server-side as `<path>-custom-<hex>`). The composite (recipe_path, recipe_id)
 * is the primary key — at most one row per recipe.
 */
export const pageRecipeOverridesTable = pgTable(
  "page_recipe_overrides",
  {
    recipePath: text("recipe_path").notNull(),
    recipeId: text("recipe_id").notNull(),
    // NULL = inherit the code default for this field (built-in recipes); always
    // populated for custom recipes (is_custom=true).
    label: text("label"),
    description: text("description"),
    styleNotes: text("style_notes"),
    // Ordered section slots. NULL on a built-in row = inherit the code skeleton;
    // a non-null array REPLACES it. Always populated for custom recipes. Each
    // entry is one slot: a block type, or "type OR alt" for alternatives.
    skeleton: jsonb("skeleton").$type<string[]>(),
    // true = a from-scratch superadmin recipe (the row IS the recipe, no code
    // fallback); false = an override of a code-defined built-in recipe.
    isCustom: boolean("is_custom").notNull().default(false),
    // Positions a custom recipe within its path's pool (built-ins first, then
    // customs by sort_order then created_at). Unused for built-in rows.
    sortOrder: integer("sort_order").notNull().default(0),
    // NOT NULL: an absent ROW means enabled; an existing row carries the flag.
    enabled: boolean("enabled").notNull().default(true),
    // app_users.id of the superadmin who last saved (nullable).
    updatedBy: integer("updated_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.recipePath, t.recipeId] }),
  }),
);

export type PageRecipeOverrideRow = typeof pageRecipeOverridesTable.$inferSelect;
