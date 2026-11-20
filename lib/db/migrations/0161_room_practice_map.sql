-- Partner Hub map: what kind of office a practice is and its phone number
-- (the address and ZIP that place it on the map were added in 0159).
ALTER TABLE "lp_room_practices" ADD COLUMN IF NOT EXISTS "office_type" text;
ALTER TABLE "lp_room_practices" ADD COLUMN IF NOT EXISTS "phone" text;
