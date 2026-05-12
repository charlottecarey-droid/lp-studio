-- Task #253 — "Approved for AI" flag on case studies (and any other library
-- type we lock down later). Defaults to TRUE so existing rows stay usable
-- by the AI. Strict-facts mode (off by default) is the gate that actually
-- filters by this column at generation time.
ALTER TABLE lp_library_items
  ADD COLUMN IF NOT EXISTS approved_for_ai BOOLEAN NOT NULL DEFAULT true;
