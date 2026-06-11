ALTER TABLE "block_catalog" ADD COLUMN IF NOT EXISTS "approved_segments" text[] NOT NULL DEFAULT '{}'::text[];
