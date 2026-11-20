-- Partner Hub welcome kits: when a practice was added to the marketing team's
-- recipient list, and which sheet that list is.
ALTER TABLE "lp_room_practices" ADD COLUMN IF NOT EXISTS "kit_sent_at" timestamp with time zone;
ALTER TABLE "lp_room_practices" ADD COLUMN IF NOT EXISTS "kit_sent_by" text;
ALTER TABLE "lp_room_autocreate" ADD COLUMN IF NOT EXISTS "kit_sheet_id" text;
ALTER TABLE "lp_room_autocreate" ADD COLUMN IF NOT EXISTS "kit_tab" text;
