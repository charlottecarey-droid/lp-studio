-- July 2026 — GLOBAL one-pager layout defaults (superadmin-managed).
--
-- sales_layout_defaults previously only held per-tenant rows, so the "global
-- default" for every built-in one-pager layout was whatever is hardcoded in
-- one-pager-types/generators.ts — fixing spacing globally required a deploy.
--
-- GLOBAL vs TENANT (mirrors the generator_presets model):
--   • tenant_id NULL → a GLOBAL default (superadmin-managed) every tenant
--     inherits when it has no row of its own for that key.
--   • tenant_id set  → that tenant's own value; it fully overrides the global
--     row for the same key (whole-row precedence, no field-level merge).
--   • Dandy-gated keys (isDandyGatedLayoutKey) never fall back to a global
--     row for non-Dandy tenants — enforced in the read routes.
--
-- The existing composite unique index (tenant_id, template_key) treats NULL
-- tenant_id rows as all-distinct, so global rows get their own partial unique
-- index: at most one global row per template_key (what the superadmin upsert's
-- ON CONFLICT clause targets).

ALTER TABLE sales_layout_defaults ALTER COLUMN tenant_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS sales_layout_defaults_global_key_idx
  ON sales_layout_defaults (template_key)
  WHERE tenant_id IS NULL;
