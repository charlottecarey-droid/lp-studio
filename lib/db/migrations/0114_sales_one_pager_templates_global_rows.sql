-- July 2026 — GLOBAL custom one-pager templates (superadmin-authored).
--
-- sales_one_pager_templates previously only held per-tenant rows, so there was
-- no way for a superadmin to publish a template every tenant can use. Now
-- (mirroring sales_layout_defaults / generator_presets):
--   • tenant_id NULL → a GLOBAL template every tenant sees read-only in its
--     gallery and can duplicate into its own workspace for editing.
--   • tenant_id set  → that tenant's own template. The tenant routes scope all
--     mutations to their own tenant_id, so they can never touch a global row.
-- Global rows are managed only via /api/admin/superadmin/one-pager-templates.

ALTER TABLE sales_one_pager_templates ALTER COLUMN tenant_id DROP NOT NULL;
