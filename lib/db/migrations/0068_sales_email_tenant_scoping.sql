-- Add tenant_id scoping to sales_email_templates and sales_email_campaigns.
--
-- Why
-- ───
-- The "multi-tenant data isolation" change to salesEmails.ts and the sales
-- email routes declared `tenantId integer NOT NULL` on both tables and made
-- every INSERT/SELECT reference + filter by `tenant_id`, but no paired
-- migration ever added the column. On existing DBs every query throws Postgres
-- 42703 "column does not exist" → the Quick Campaigns wizard fails with
-- "Failed to create template" and campaign create/list/preview all 500.
--
-- Backfill strategy
-- ─────────────────
--   sales_email_campaigns ← sales_accounts.tenant_id (via account_id when set).
--                           Drafts/legacy rows with no account fall back to
--                           tenant 1 (Dandy).
--   sales_email_templates ← no tenant-bearing parent exists; pin all legacy
--                           rows to tenant 1 (Dandy).
-- Any still-null rows are pinned to tenant 1 so the NOT NULL constraint applies
-- cleanly. ADD COLUMN IF NOT EXISTS keeps this idempotent across environments.

-- ─── sales_email_templates ──────────────────────────────────────────────
ALTER TABLE "sales_email_templates"
  ADD COLUMN IF NOT EXISTS "tenant_id" integer;

-- No tenant-bearing parent — pin all legacy rows to tenant 1 = Dandy.
UPDATE "sales_email_templates"
   SET "tenant_id" = 1
 WHERE "tenant_id" IS NULL;

ALTER TABLE "sales_email_templates"
  ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "sales_email_templates"
  DROP CONSTRAINT IF EXISTS "sales_email_templates_tenant_id_fkey";
ALTER TABLE "sales_email_templates"
  ADD CONSTRAINT "sales_email_templates_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id");

CREATE INDEX IF NOT EXISTS "idx_sales_email_templates_tenant_id"
  ON "sales_email_templates" ("tenant_id");

-- ─── sales_email_campaigns ──────────────────────────────────────────────
ALTER TABLE "sales_email_campaigns"
  ADD COLUMN IF NOT EXISTS "tenant_id" integer;

-- Primary path: inherit from the linked sales_account.
UPDATE "sales_email_campaigns" c
   SET "tenant_id" = a."tenant_id"
  FROM "sales_accounts" a
 WHERE c."account_id" = a."id"
   AND c."tenant_id" IS NULL;

-- Drafts/legacy rows with no account go to tenant 1 = Dandy.
UPDATE "sales_email_campaigns"
   SET "tenant_id" = 1
 WHERE "tenant_id" IS NULL;

ALTER TABLE "sales_email_campaigns"
  ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "sales_email_campaigns"
  DROP CONSTRAINT IF EXISTS "sales_email_campaigns_tenant_id_fkey";
ALTER TABLE "sales_email_campaigns"
  ADD CONSTRAINT "sales_email_campaigns_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id");

CREATE INDEX IF NOT EXISTS "idx_sales_email_campaigns_tenant_id"
  ON "sales_email_campaigns" ("tenant_id");
