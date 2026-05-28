-- Workstream B (May 2026 AI output-quality plan): persist the banned-phrase
-- post-validator's findings per generation. One JSON array of hit objects
-- (phrase, source, blockId, blockType, field, snippet) so we can correlate
-- cliché/brand-forbidden leakage with output quality and feed Workstream C's
-- critique pass. Additive, defaulted, never blocks a generation.
ALTER TABLE ai_generation_log
  ADD COLUMN IF NOT EXISTS banned_phrase_hits jsonb NOT NULL DEFAULT '[]'::jsonb;
