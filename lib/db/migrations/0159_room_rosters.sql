-- Partner Hub rosters: doctors tied to practices, and the address / office
-- manager a customer's roster carries.
ALTER TABLE "lp_room_practices" ADD COLUMN IF NOT EXISTS "address" text;
ALTER TABLE "lp_room_practices" ADD COLUMN IF NOT EXISTS "zip" text;
ALTER TABLE "lp_room_practices" ADD COLUMN IF NOT EXISTS "office_manager" text;
ALTER TABLE "lp_room_uploads" ADD COLUMN IF NOT EXISTS "roster_result" jsonb;

CREATE TABLE IF NOT EXISTS "lp_room_doctors" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenant_id" integer NOT NULL,
  "page_id" integer NOT NULL,
  "practice_id" integer,
  "practice_name" text,
  "name" text NOT NULL,
  "email" text,
  "npi" text,
  "role" text,
  "upload_id" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "lp_room_doctors_page_idx" ON "lp_room_doctors" ("page_id", "practice_id");
