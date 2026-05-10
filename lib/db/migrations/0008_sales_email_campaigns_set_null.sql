-- Sales email campaigns: survive template/account deletion (task #143)
--
-- Why
-- ───
-- `sales_email_campaigns.template_id` and `account_id` previously had no
-- ON DELETE clause (defaulting to RESTRICT) and template_id was NOT NULL.
-- That meant deleting a referenced template or account either failed
-- outright or risked dangling references. Campaigns are historical
-- records that should outlive their parents, so we relax both columns to
-- nullable and switch the FKs to ON DELETE SET NULL.
-- Drop existing FKs regardless of naming convention (Postgres default `_fkey`
-- vs Drizzle-style `_<reftable>_<refcol>_fk`). Verified in the dev DB the
-- live names are the Postgres defaults, but we drop both variants defensively
-- so this migration is idempotent across environments.
ALTER TABLE sales_email_campaigns
  DROP CONSTRAINT IF EXISTS sales_email_campaigns_template_id_fkey;

ALTER TABLE sales_email_campaigns
  DROP CONSTRAINT IF EXISTS sales_email_campaigns_template_id_sales_email_templates_id_fk;

ALTER TABLE sales_email_campaigns
  DROP CONSTRAINT IF EXISTS sales_email_campaigns_account_id_fkey;

ALTER TABLE sales_email_campaigns
  DROP CONSTRAINT IF EXISTS sales_email_campaigns_account_id_sales_accounts_id_fk;

ALTER TABLE sales_email_campaigns
  ALTER COLUMN template_id DROP NOT NULL;

ALTER TABLE sales_email_campaigns
  ADD CONSTRAINT sales_email_campaigns_template_id_fkey
  FOREIGN KEY (template_id) REFERENCES sales_email_templates(id)
  ON DELETE SET NULL;

ALTER TABLE sales_email_campaigns
  ADD CONSTRAINT sales_email_campaigns_account_id_fkey
  FOREIGN KEY (account_id) REFERENCES sales_accounts(id)
  ON DELETE SET NULL;
