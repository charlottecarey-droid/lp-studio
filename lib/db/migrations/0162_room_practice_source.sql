-- Partner Hub practices: what an upload gives wins over the synced sheet.
-- `source` = 'upload' marks a practice an upload added (the sheet sync never
-- removes it); `kept_fields` lists the fields an upload set (the sync leaves
-- them alone).
ALTER TABLE "lp_room_practices" ADD COLUMN IF NOT EXISTS "source" text;
ALTER TABLE "lp_room_practices" ADD COLUMN IF NOT EXISTS "kept_fields" jsonb;
