-- Block catalog + schema-migration-markers tables. These were previously
-- created inline at the top of the block_catalog seed step in
-- artifacts/api-server/src/migrate.ts; moved here so all schema DDL lives
-- in tracked .sql files. The marker table is used by the JS-driven seeds
-- (block_catalog / global_templates / starter_images / etc.) to ensure
-- each seed runs at most once per database.

CREATE TABLE IF NOT EXISTS _schema_migration_markers (
  key         text PRIMARY KEY,
  applied_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS block_catalog (
  block_type    text NOT NULL,
  industry      text NOT NULL,
  label         text NOT NULL,
  category      text NOT NULL,
  default_props jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_enabled    boolean NOT NULL DEFAULT true,
  sort_order    integer NOT NULL DEFAULT 0,
  updated_by    integer,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (block_type, industry)
);

CREATE INDEX IF NOT EXISTS block_catalog_industry_idx ON block_catalog(industry);

-- Backfill `updated_by` on databases whose block_catalog was created
-- before that column existed in the CREATE TABLE above. CREATE TABLE
-- IF NOT EXISTS is a no-op for an existing table, so without this
-- ALTER the superadmin GET /admin/block-catalog (which selects
-- updated_by) would 500 with `column "updated_by" does not exist`.
ALTER TABLE block_catalog ADD COLUMN IF NOT EXISTS updated_by integer;
