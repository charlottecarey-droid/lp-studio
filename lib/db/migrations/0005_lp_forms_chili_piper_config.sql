-- Add per-tenant Chili Piper handoff configuration to lp_forms.
--
-- Stored as jsonb so we can carry the scheduler URL plus the optional
-- field-name remap and modal/redirect mode without an ALTER per knob.
-- Shape (validated in app code at lp-studio/src/lib/chili-piper-handoff.ts):
--   { url: string, mode?: "modal"|"redirect", fieldMap?: Record<string,string|string[]> }
--
-- Idempotent so re-running this migration on environments where the column
-- was already manually applied (dev / NEON pre-rollout) is a no-op.
ALTER TABLE lp_forms ADD COLUMN IF NOT EXISTS chili_piper_config jsonb;
