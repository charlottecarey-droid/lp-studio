-- Partner rooms: weekly digest. Off until the team turns it on and names
-- who receives it; last_digest_at is the claim that stops a double send.
ALTER TABLE lp_room_settings ADD COLUMN IF NOT EXISTS digest_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE lp_room_settings ADD COLUMN IF NOT EXISTS digest_recipients jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE lp_room_settings ADD COLUMN IF NOT EXISTS last_digest_at timestamptz;

-- A live Google Sheet as the room's practice list (the source of truth while
-- it is connected): the sheet id, the tab, and when it was last read.
ALTER TABLE lp_room_settings ADD COLUMN IF NOT EXISTS practices_sheet_id text;
ALTER TABLE lp_room_settings ADD COLUMN IF NOT EXISTS practices_sheet_tab text;
ALTER TABLE lp_room_settings ADD COLUMN IF NOT EXISTS practices_synced_at timestamptz;
ALTER TABLE lp_room_settings ADD COLUMN IF NOT EXISTS practices_sync_note text;
