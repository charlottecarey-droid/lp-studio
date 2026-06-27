-- 0109_page_recipe_overrides_structure
-- Expand page_recipe_overrides from a WORDING-only override store into a full
-- recipe BUILDER store (June 2026). Built-in recipes can now override their
-- section SKELETON (block order), and superadmins can create CUSTOM recipes
-- (is_custom=true) ordered by sort_order. Idempotent / additive.
ALTER TABLE page_recipe_overrides ADD COLUMN IF NOT EXISTS skeleton jsonb;
ALTER TABLE page_recipe_overrides ADD COLUMN IF NOT EXISTS is_custom boolean NOT NULL DEFAULT false;
ALTER TABLE page_recipe_overrides ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
