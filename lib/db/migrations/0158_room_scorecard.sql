-- Partner Hub scorecard: more Salesforce columns per practice, and a daily
-- snapshot of the stage counts for trends.
ALTER TABLE "lp_room_practices" ADD COLUMN IF NOT EXISTS "scanner_brand" text;
ALTER TABLE "lp_room_practices" ADD COLUMN IF NOT EXISTS "contract_signed" text;
ALTER TABLE "lp_room_practices" ADD COLUMN IF NOT EXISTS "source_status" text;
ALTER TABLE "lp_room_practices" ADD COLUMN IF NOT EXISTS "owner" text;
ALTER TABLE "lp_room_practices" ADD COLUMN IF NOT EXISTS "last_activity" text;

CREATE TABLE IF NOT EXISTS "lp_room_practice_snapshots" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenant_id" integer NOT NULL,
  "page_id" integer NOT NULL,
  "day" text NOT NULL,
  "total" integer DEFAULT 0 NOT NULL,
  "by_stage" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "scanners" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "lp_room_practice_snapshots_page_day_uniq" ON "lp_room_practice_snapshots" ("page_id", "day");
