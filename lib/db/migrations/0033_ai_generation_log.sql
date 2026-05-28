-- Observability + training-data substrate for the AI page-generation
-- pipeline (Workstreams A/B/C of the May 2026 output-quality plan).
-- One row per call to /api/lp/generate-page (and friends). Append-only.

CREATE TABLE IF NOT EXISTS "ai_generation_log" (
  "id" serial PRIMARY KEY,
  "tenant_id" integer,
  "page_id" integer,
  "endpoint" text NOT NULL,
  "prompt_path" text,
  "prompt_hash" text NOT NULL,
  "prompt_preview" text,
  "reference_urls" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "inspiration_urls" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "sections_included" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "template_id" integer,
  "composer_duration_ms" integer,
  "critique_ran" boolean NOT NULL DEFAULT false,
  "critique_rewrote_block_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "output_block_types" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "used_screenshot" boolean NOT NULL DEFAULT false,
  "error_message" text,
  "was_published_after" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "ai_generation_log_tenant_id_idx"  ON "ai_generation_log" ("tenant_id");
CREATE INDEX IF NOT EXISTS "ai_generation_log_created_at_idx" ON "ai_generation_log" ("created_at");
CREATE INDEX IF NOT EXISTS "ai_generation_log_page_id_idx"    ON "ai_generation_log" ("page_id");
