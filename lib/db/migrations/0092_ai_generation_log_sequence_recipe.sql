-- June 2026 — page-variety workstream (recipe rotation + block-sequence
-- repeat guard). Additive, nullable columns on the existing per-generation
-- log table:
--   sequence_hash — sha1 of the page's non-structural block-type sequence;
--                   the repeat guard reads a tenant's recent hashes and
--                   re-prompts once when a new page collides.
--   recipe_id     — the page recipe injected into the prompt for this
--                   generation; the rotation picks the least-recently-used.
-- Template-path rows and failed generations leave both null. Fail-open: the
-- generation pipeline tolerates missing/null values entirely.
ALTER TABLE "ai_generation_log" ADD COLUMN IF NOT EXISTS "sequence_hash" text;
ALTER TABLE "ai_generation_log" ADD COLUMN IF NOT EXISTS "recipe_id" text;
