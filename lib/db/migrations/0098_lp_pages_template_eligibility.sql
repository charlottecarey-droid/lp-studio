-- June 2026 — template eligibility (data-driven template gating).
-- Additive columns on lp_pages, meaningful only on template rows
-- (is_template = true); regular pages leave them at NULL. Templates DECLARE
-- where they are allowed to be AUTO-recommended; the eligibility engine
-- (lib/ai-prompts/template-eligibility.ts) gates auto-recommendation against
-- them. All three are NULLABLE and FAIL-OPEN — NULL/empty = ANY (no
-- restriction), so existing templates keep working everywhere and manual
-- selection is never affected.
--   eligible_segments      — jsonb string[] of segment names/ids the template
--                            may be used for. NULL/empty = ANY segment.
--   eligible_personas      — jsonb string[] of personas it's appropriate for.
--                            NULL/empty = ANY persona.
--   eligible_funnel_stages — jsonb string[] of funnel stages/motions it fits.
--                            NULL/empty = ANY. The ALLOWED set (vs. the singular
--                            funnel_stage PRIMARY stage); defaults to
--                            [funnel_stage] when only the primary is known.
--   funnel_stage           — text, the template's PRIMARY funnel stage. Was
--                            previously derived client-side from the seed; now
--                            persisted so tenant-created templates participate
--                            in eligibility too. NULL = ungrouped.
-- Backfill of the seeded funnel-stage templates is marker-gated in
-- artifacts/api-server/src/migrate.ts (global_templates_eligibility_v1) and
-- null-guarded so manual edits to these fields are preserved.
ALTER TABLE lp_pages ADD COLUMN IF NOT EXISTS eligible_segments jsonb;
ALTER TABLE lp_pages ADD COLUMN IF NOT EXISTS eligible_personas jsonb;
ALTER TABLE lp_pages ADD COLUMN IF NOT EXISTS eligible_funnel_stages jsonb;
ALTER TABLE lp_pages ADD COLUMN IF NOT EXISTS funnel_stage text;
