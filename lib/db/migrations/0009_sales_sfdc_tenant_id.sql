-- Tag sales briefings and Salesforce-synced records with their tenant (task #146)
--
-- Why
-- ───
-- `sales_briefings`, `sfdc_leads`, and `sfdc_opportunities` were added without
-- a `tenant_id` column. Isolation today only works transitively through FK
-- joins to parent rows (sales_accounts, sfdc_connections). Any direct SELECT
-- — or a route that simply forgot to join — would silently leak across
-- tenants. Adding an explicit `tenant_id` (NOT NULL, FK + index) makes
-- isolation structural rather than incidental and lets us scope queries
-- directly via `getTenantId(req, res)`.
--
-- Backfill strategy
-- ─────────────────
--   sales_briefings    ← sales_accounts.tenant_id (via account_id; NOT NULL FK)
--   sfdc_opportunities ← sales_accounts.tenant_id (via account_id when set),
--                        falling back to sfdc_connections.tenant_id when the
--                        opportunity is unlinked. There is no direct FK from
--                        sfdc_opportunities → sfdc_connections, so the
--                        fallback picks the lone connection's tenant when
--                        exactly one exists, else defaults to tenant 1.
--   sfdc_leads         ← sfdc_connections.tenant_id when exactly one
--                        connection exists, else tenant 1. There is no
--                        direct path from a Lead row to its source
--                        connection in the current schema. TODO: once Leads
--                        carry a connection_id (or are scoped at sync time),
--                        replace this with a join-based backfill.

-- ─── sales_briefings ─────────────────────────────────────────
ALTER TABLE sales_briefings
  ADD COLUMN IF NOT EXISTS tenant_id integer;

UPDATE sales_briefings sb
SET tenant_id = sa.tenant_id
FROM sales_accounts sa
WHERE sb.account_id = sa.id
  AND sb.tenant_id IS NULL;

-- Safety net: any row whose parent vanished gets pinned to tenant 1.
-- Should be a no-op in practice given the existing ON DELETE CASCADE FK.
UPDATE sales_briefings SET tenant_id = 1 WHERE tenant_id IS NULL;

ALTER TABLE sales_briefings
  ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE sales_briefings
  ADD CONSTRAINT sales_briefings_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_sales_briefings_tenant_id
  ON sales_briefings(tenant_id);

-- ─── sfdc_opportunities ──────────────────────────────────────
ALTER TABLE sfdc_opportunities
  ADD COLUMN IF NOT EXISTS tenant_id integer;

-- Primary path: inherit from the linked sales_account.
UPDATE sfdc_opportunities so
SET tenant_id = sa.tenant_id
FROM sales_accounts sa
WHERE so.account_id = sa.id
  AND so.tenant_id IS NULL;

-- Fallback: opportunity has no linked account. Use the unique sfdc_connections
-- tenant if there is exactly one; otherwise default to tenant 1 (TODO: once
-- opportunities carry a connection_id, drop the default fallback).
UPDATE sfdc_opportunities
SET tenant_id = COALESCE(
  (SELECT tenant_id
     FROM sfdc_connections
     WHERE tenant_id IS NOT NULL
     GROUP BY tenant_id
     HAVING COUNT(*) = (SELECT COUNT(*) FROM sfdc_connections WHERE tenant_id IS NOT NULL)
     LIMIT 1),
  1
)
WHERE tenant_id IS NULL;

ALTER TABLE sfdc_opportunities
  ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE sfdc_opportunities
  ADD CONSTRAINT sfdc_opportunities_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_sfdc_opportunities_tenant_id
  ON sfdc_opportunities(tenant_id);

-- ─── sfdc_leads ──────────────────────────────────────────────
ALTER TABLE sfdc_leads
  ADD COLUMN IF NOT EXISTS tenant_id integer;

-- No direct path from sfdc_leads → sfdc_connections in the schema today.
-- Use the unique connection tenant if there is exactly one, else default to
-- tenant 1 (Dandy). TODO: once leads carry a connection_id, replace this
-- with a join-based backfill from sfdc_connections.tenant_id.
UPDATE sfdc_leads
SET tenant_id = COALESCE(
  (SELECT tenant_id
     FROM sfdc_connections
     WHERE tenant_id IS NOT NULL
     GROUP BY tenant_id
     HAVING COUNT(*) = (SELECT COUNT(*) FROM sfdc_connections WHERE tenant_id IS NOT NULL)
     LIMIT 1),
  1
)
WHERE tenant_id IS NULL;

ALTER TABLE sfdc_leads
  ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE sfdc_leads
  ADD CONSTRAINT sfdc_leads_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_sfdc_leads_tenant_id
  ON sfdc_leads(tenant_id);
