-- Task #4: per-tenant, per-block governance (enabled / AI mode / segment approval).
-- Fail-open: the table starts empty; a missing row resolves to enabled + 'open'
-- AI mode + no segments, which is identical to current behaviour. No data
-- backfill is required to preserve day-one behaviour.
CREATE TABLE IF NOT EXISTS "tenant_block_governance" (
  "tenant_id" integer NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "block_type" text NOT NULL,
  "enabled" boolean,
  "ai_mode" text NOT NULL DEFAULT 'open',
  "segments" text[] NOT NULL DEFAULT '{}'::text[],
  "updated_by" integer,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "tenant_block_governance_pk" PRIMARY KEY ("tenant_id", "block_type")
);
