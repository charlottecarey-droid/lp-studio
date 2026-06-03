-- Fix 1 (Prompt 2 / database integrity) — tenant-scope lp_integrations.
--
-- Status on prod/staging (audited June 2026): lp_integrations ALREADY has
--   * tenant_id integer NOT NULL
--   * FK  lp_integrations_tenant_id_fkey            -> tenants(id)   (no ON DELETE clause)
--   * UNIQUE lp_integrations_tenant_provider_key (tenant_id, provider)
-- and the original provider-only UNIQUE has already been dropped. Every
-- statement below is therefore a deliberate no-op on prod.
--
-- The value of this migration is FRESH-DB PARITY: a database built from the
-- migration chain (e.g. the future pg_dump baseline) creates lp_integrations
-- via 0000 as `provider text NOT NULL UNIQUE` with no tenant_id. This migration
-- brings that fresh schema to the exact prod shape: add tenant_id (+ FK),
-- backfill, NOT NULL, drop the provider-only UNIQUE, add the composite UNIQUE.
--
-- Idempotency / no-op notes:
--   * ADD COLUMN IF NOT EXISTS — on prod the column exists, so the column AND
--     its inline FK are skipped and the existing lp_integrations_tenant_id_fkey
--     is left exactly as-is. On a fresh DB the column is created together with
--     the FK, which Postgres names lp_integrations_tenant_id_fkey (same as prod).
--     We intentionally do NOT add ON DELETE CASCADE: prod's FK has none and the
--     goal here is an identical schema, not a behavioural change. (Whether
--     lp_integrations should cascade on tenant delete is out of scope for Fix 1.)
--   * The backfill UPDATE touches 0 rows on prod (no NULLs) and on a fresh empty
--     table; it exists only for a hypothetical partially-migrated database.
--   * SET NOT NULL is a no-op where the column is already NOT NULL.
--   * The composite UNIQUE is added only when no constraint of that name exists,
--     so re-running (and prod, which already has it) is a true no-op.

ALTER TABLE lp_integrations
  ADD COLUMN IF NOT EXISTS tenant_id integer REFERENCES tenants(id);

UPDATE lp_integrations
   SET tenant_id = 1
 WHERE tenant_id IS NULL;

ALTER TABLE lp_integrations
  ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE lp_integrations
  DROP CONSTRAINT IF EXISTS lp_integrations_provider_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'lp_integrations'::regclass
      AND conname = 'lp_integrations_tenant_provider_key'
  ) THEN
    ALTER TABLE lp_integrations
      ADD CONSTRAINT lp_integrations_tenant_provider_key UNIQUE (tenant_id, provider);
  END IF;
END $$;
