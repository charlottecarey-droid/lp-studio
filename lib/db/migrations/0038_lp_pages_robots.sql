-- Task #494 — SEO robots controls.
-- Per-page robots overrides. NULLABLE with NO default on purpose: NULL means
-- "inherit the tenant default" (tenants.settings.seo.*), true = force allow,
-- false = force deny. Resolution into a <meta name="robots"> tag happens in
-- application code, never the DB. Tenant-level defaults are backfilled into
-- tenants.settings by a marker-guarded step in api-server/src/migrate.ts.
ALTER TABLE "lp_pages" ADD COLUMN IF NOT EXISTS "allow_indexing" boolean;
ALTER TABLE "lp_pages" ADD COLUMN IF NOT EXISTS "allow_following" boolean;
