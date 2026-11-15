-- Partner rooms: more about each practice, read from the same sheet when the
-- columns are there: when its scanner was sent and activated, and its
-- regional manager.
ALTER TABLE lp_room_practices ADD COLUMN IF NOT EXISTS scanner_sent text;
ALTER TABLE lp_room_practices ADD COLUMN IF NOT EXISTS scanner_activated text;
ALTER TABLE lp_room_practices ADD COLUMN IF NOT EXISTS regional_manager text;
-- How many scanners the practice has and which models ("1 Trios 3 · 3 Dandy
-- Vision"), from the scanner tracker's office breakdown.
ALTER TABLE lp_room_practices ADD COLUMN IF NOT EXISTS scanner_count integer;
ALTER TABLE lp_room_practices ADD COLUMN IF NOT EXISTS scanner_models text;
