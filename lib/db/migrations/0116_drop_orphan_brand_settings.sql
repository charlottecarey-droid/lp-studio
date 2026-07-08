-- 0116: delete lp_brand_settings rows whose tenant does not exist.
--
-- Why: lp_brand_settings.tenant_id has NO foreign key, and migration 0020
-- unconditionally seeds a row for tenant_id = 1 carrying Dandy's sales-console
-- config (sender 'Dandy', ent.meetdandy.com, sales@meetdandy.com). On a FRESH
-- database (the public-instance plan, July 2026) that row is an orphan — and
-- because tenants.id is serial, the first real tenant created on that
-- instance would get id 1 and silently inherit Dandy's config.
--
-- Safe on every existing database: rows whose tenant exists (Dandy prod
-- included) are untouched; only orphans are removed. Runs after 0020 by
-- ordering, so a fresh boot seeds the orphan and immediately drops it.
DELETE FROM lp_brand_settings bs
WHERE NOT EXISTS (SELECT 1 FROM tenants t WHERE t.id = bs.tenant_id);
