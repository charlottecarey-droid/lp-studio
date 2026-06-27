import { pgTable, text, integer, boolean, timestamp, primaryKey } from "drizzle-orm/pg-core";

/**
 * page_recipe_overrides — superadmin WORDING overrides for the AI page-generation
 * "recipes" (June 2026, page-variety workstream).
 *
 * The recipes themselves (their id, section SKELETON / block order, and the
 * three prompt paths) stay HARDCODED in
 * api-server/src/lib/ai-prompts/page-recipes.ts — that code is the source of
 * truth and the fallback. This table only stores a superadmin's optional
 * overrides of the human-facing WORDING (label / description / styleNotes) plus
 * an on/off flag, per recipe. It NEVER changes a recipe's block skeleton.
 *
 * SHADOW-OVERRIDE semantics (mirrors generator_preset_overrides):
 *   • No row for a (recipe_path, recipe_id) → pure code default, enabled.
 *   • A NULL label/description/style_notes column → inherit that field from code.
 *   • enabled=false → the recipe is dropped from the AI rotation pool.
 *   • DELETE the row → reset the recipe fully to its code default.
 * The merge is applied at generation time by loadEffectiveRecipesForPath().
 *
 * recipe_path is one of the RecipePromptPath values ('freeform' | 'dso' |
 * 'dso-practices'); recipe_id is a PageRecipe.id. The composite (recipe_path,
 * recipe_id) is the primary key — at most one override row per recipe.
 */
export const pageRecipeOverridesTable = pgTable(
  "page_recipe_overrides",
  {
    recipePath: text("recipe_path").notNull(),
    recipeId: text("recipe_id").notNull(),
    // NULL = inherit the code default for this field.
    label: text("label"),
    description: text("description"),
    styleNotes: text("style_notes"),
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
