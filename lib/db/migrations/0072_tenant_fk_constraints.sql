-- Fix 3 (Prompt 2 / database integrity) — tenant FK constraints + orphan cleanup.
--
-- Four tenant-scoped tables carry a NOT NULL tenant_id but have NO foreign key
-- to tenants, so when a tenant was deleted its rows in these tables were left
-- behind as dangling pointers. This migration deletes those orphans and adds
-- ON DELETE CASCADE foreign keys so it cannot recur.
--
-- DESTRUCTIVE — the two DELETEs below remove 129 production rows. These rows
-- were enumerated by a read-only audit and explicitly signed off by the
-- product owner before this file was committed. The deletes are written as
-- "tenant_id NOT IN (SELECT id FROM tenants)" (tenants.id is the PK, never
-- NULL, so NOT IN is safe) — they remove exactly the audited orphan rows and
-- nothing else.
--
-- Audited orphan counts (read-only audit against the Neon prod clone,
-- 2026-06-03):
--   lp_proof_points          : 13 orphans (deleted tenants 20575, 24326)
--   sales_one_pager_templates : 116 orphans (116 distinct deleted tenants)
--   sales_hotlinks            : 0 orphans
--   lp_page_ad_copy_runs      : 0 orphans
--
-- IDEMPOTENT: the DELETEs are no-ops once the orphans are gone, and each FK is
-- added inside a DO-block guarded by a pg_constraint existence check. Re-running
-- is safe.
--
-- Convention: NO BEGIN/COMMIT — drizzle's node-postgres migrator wraps the whole
-- batch in a single transaction, so an explicit COMMIT here would prematurely
-- end that transaction. (The published spec template included BEGIN/COMMIT; that
-- is incorrect for this runner.) DO $$ blocks are used for the guarded ADDs,
-- matching the precedent in 0019 / 0046 / 0071.
--
-- Journal note: this is idx 72 with when 1752700000000 — deliberately GREATER
-- than 0073's 1752600000000 even though the file number is lower, so that on
-- prod / already-migrated clones (whose drizzle high-water mark already sits at
-- 1752600000000 from 0073) this destructive migration is NOT silently skipped.

-- ─── Cleanup dangling tenant pointers (DESTRUCTIVE, pre-audited) ─────────────

DELETE FROM lp_proof_points
  WHERE tenant_id NOT IN (SELECT id FROM tenants);

DELETE FROM sales_one_pager_templates
  WHERE tenant_id NOT IN (SELECT id FROM tenants);

-- ─── Add ON DELETE CASCADE foreign keys (idempotent) ────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'sales_hotlinks'::regclass
      AND conname = 'sales_hotlinks_tenant_id_fkey'
  ) THEN
    ALTER TABLE sales_hotlinks
      ADD CONSTRAINT sales_hotlinks_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'lp_page_ad_copy_runs'::regclass
      AND conname = 'lp_page_ad_copy_runs_tenant_id_fkey'
  ) THEN
    ALTER TABLE lp_page_ad_copy_runs
      ADD CONSTRAINT lp_page_ad_copy_runs_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'lp_proof_points'::regclass
      AND conname = 'lp_proof_points_tenant_id_fkey'
  ) THEN
    ALTER TABLE lp_proof_points
      ADD CONSTRAINT lp_proof_points_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'sales_one_pager_templates'::regclass
      AND conname = 'sales_one_pager_templates_tenant_id_fkey'
  ) THEN
    ALTER TABLE sales_one_pager_templates
      ADD CONSTRAINT sales_one_pager_templates_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
END $$;
