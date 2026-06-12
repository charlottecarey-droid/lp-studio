-- June 2026 — all-in-one template intent selection.
-- Additive columns on lp_pages, meaningful only on template rows
-- (is_template = true); regular pages leave them at their defaults:
--   category      — coarse intent bucket ("storefront", "content-series",
--                   "blog", "business-case", "event", "restaurant",
--                   "portfolio", "services", "saas-launch", "generic").
--                   NULL = untagged (treated as generic).
--   keywords      — jsonb string[] of intent phrases the AI generation route
--                   matches against the user's prompt (template-intent.ts).
--                   NULL = no keywords (never intent-matched).
--   is_all_in_one — true for monolithic single-block templates AND curated
--                   multi-block recipes whose structure must not gain extra
--                   blocks. Only is_all_in_one rows enter the intent
--                   selector's candidate set.
-- Backfill of the seeded all-in-one templates is marker-gated in
-- artifacts/api-server/src/migrate.ts (global_templates_intent_v1) and
-- null-guarded so manual edits to these fields are preserved.
ALTER TABLE lp_pages ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE lp_pages ADD COLUMN IF NOT EXISTS keywords jsonb;
ALTER TABLE lp_pages ADD COLUMN IF NOT EXISTS is_all_in_one boolean NOT NULL DEFAULT false;
