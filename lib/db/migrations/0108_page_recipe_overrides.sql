-- June 2026 — superadmin WORDING overrides for AI page-generation RECIPES.
--
-- The recipes (their id, section SKELETON / block order, and the three prompt
-- paths) stay HARDCODED in api-server/src/lib/ai-prompts/page-recipes.ts; that
-- code is the source of truth and the fallback. This table only stores a
-- superadmin's optional overrides of each recipe's human-facing WORDING
-- (label / description / style_notes) plus an on/off flag. It NEVER changes a
-- recipe's block skeleton.
--
-- SHADOW-OVERRIDE semantics (mirrors generator_preset_overrides):
--   • No row for a (recipe_path, recipe_id)  → pure code default, enabled.
--   • A NULL label/description/style_notes    → inherit that field from code.
--   • enabled = false                         → recipe dropped from AI rotation.
--   • DELETE the row                          → reset fully to the code default.
--
-- recipe_path is a RecipePromptPath ('freeform' | 'dso' | 'dso-practices');
-- recipe_id is a PageRecipe.id. The composite (recipe_path, recipe_id) is the
-- primary key — at most one override row per recipe. An empty table = today's
-- behaviour (every recipe at its code default, enabled).

CREATE TABLE IF NOT EXISTS page_recipe_overrides (
  recipe_path  text        NOT NULL,
  recipe_id    text        NOT NULL,
  label        text,
  description  text,
  style_notes  text,
  enabled      boolean     NOT NULL DEFAULT true,
  updated_by   integer,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (recipe_path, recipe_id)
);
