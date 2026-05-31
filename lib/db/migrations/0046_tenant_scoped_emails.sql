-- Task #588 — Tenant-scoped email system (Phase 2).
--
-- Extends the Phase-1 platform email system with a `scope` dimension so tenant
-- admins can author their own tenant-scope notification templates, plus a
-- per-tenant branded email shell. Existing rows are platform-scope; there is no
-- data migration. Platform rendering is unchanged (byte-identical).

-- 1. Scope dimension on the shared template table. Existing rows default to
--    platform scope with a NULL tenant_id.
ALTER TABLE notification_templates
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'platform';
ALTER TABLE notification_templates
  ADD COLUMN IF NOT EXISTS tenant_id integer REFERENCES tenants(id) ON DELETE CASCADE;

-- 2. Replace the (key) primary key with a surrogate id so multiple tenants can
--    each own a row for the same template key. Uniqueness is enforced by the
--    partial indexes below: one platform row per key, one tenant row per
--    (tenant_id, key).
ALTER TABLE notification_templates DROP CONSTRAINT IF EXISTS notification_templates_pkey;
ALTER TABLE notification_templates ADD COLUMN IF NOT EXISTS id serial;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'notification_templates_pkey'
       AND conrelid = 'notification_templates'::regclass
  ) THEN
    ALTER TABLE notification_templates
      ADD CONSTRAINT notification_templates_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- 3. Uniqueness. The platform index matches the `ON CONFLICT (key) WHERE
--    scope = 'platform'` arbiter used by the superadmin template upsert.
CREATE UNIQUE INDEX IF NOT EXISTS notification_templates_platform_key_uniq
  ON notification_templates (key) WHERE scope = 'platform';
CREATE UNIQUE INDEX IF NOT EXISTS notification_templates_tenant_key_uniq
  ON notification_templates (tenant_id, key) WHERE scope = 'tenant';

-- 4. Integrity: platform ⇒ tenant_id NULL; tenant ⇒ tenant_id NOT NULL.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'notification_templates_scope_tenant_chk'
       AND conrelid = 'notification_templates'::regclass
  ) THEN
    ALTER TABLE notification_templates
      ADD CONSTRAINT notification_templates_scope_tenant_chk
      CHECK ((scope = 'platform' AND tenant_id IS NULL)
          OR (scope = 'tenant'   AND tenant_id IS NOT NULL));
  END IF;
END $$;

-- Hot path for the tenant template loader: resolve one tenant's overrides.
CREATE INDEX IF NOT EXISTS notification_templates_tenant_lookup_idx
  ON notification_templates (tenant_id) WHERE scope = 'tenant';

-- 5. Per-tenant branded email shell. Mirrors email_shell_templates (the platform
--    singleton) but keyed by tenant_id. Any NULL column falls back first to the
--    tenant's brand-derived shell, then to the platform code default, so a
--    missing row or hiccup can never produce a broken frame.
CREATE TABLE IF NOT EXISTS tenant_email_shells (
  tenant_id   integer PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  shell_html  text,
  logo_html   text,
  header_bg   text,
  footer_html text,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  text
);
