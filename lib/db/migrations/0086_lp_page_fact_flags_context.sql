-- Task #1197 — capture human-readable context for each reviewable fact so the
-- "Review facts" modal can explain what a value means (its sibling label or the
-- nearest block heading) and prefill a meaningful library label on save.
-- ADD COLUMN IF NOT EXISTS so this is an idempotent no-op heal on DBs that
-- already have the column.
ALTER TABLE lp_page_fact_flags ADD COLUMN IF NOT EXISTS context_label text;
