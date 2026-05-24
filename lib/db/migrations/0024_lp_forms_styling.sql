-- Per-form visual styling (background, surface, input/button colors, fonts).
-- NULL = use the block-level styling already on each rendered form block,
-- so existing forms render identically until an operator opts in.
-- The Inside Dandy / Apple Vision Pro preset surfaced in the Forms editor
-- writes a fully-populated object here (see FORM_STYLING_AVP_PRESET in
-- artifacts/lp-studio/src/lib/form-styling.ts).
ALTER TABLE lp_forms ADD COLUMN IF NOT EXISTS styling jsonb;
