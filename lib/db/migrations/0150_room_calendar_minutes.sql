-- Partner rooms: calendar sync + meeting minutes.
--   lp_room_settings.calendar_*  the Google Calendar the room reads (through
--                                the workspace's Calendar connection); events
--                                with a guest at one of the room's allowed
--                                domains appear in the room.
--   lp_room_events               one row per synced event. Minutes drafted from
--                                the meeting's notes doc live on the same row
--                                and stay hidden from the customer until the
--                                team publishes them (minutes_status).
ALTER TABLE lp_room_settings ADD COLUMN IF NOT EXISTS calendar_id text;
ALTER TABLE lp_room_settings ADD COLUMN IF NOT EXISTS calendar_synced_at timestamptz;
ALTER TABLE lp_room_settings ADD COLUMN IF NOT EXISTS calendar_sync_note text;

CREATE TABLE IF NOT EXISTS lp_room_events (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL,
  page_id integer NOT NULL,
  external_id text NOT NULL,
  title text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  all_day boolean NOT NULL DEFAULT false,
  hidden boolean NOT NULL DEFAULT false,
  attendees text,
  notes_file_id text,
  minutes_status text,
  minutes jsonb,
  minutes_drafted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS lp_room_events_page_ext_uniq ON lp_room_events (page_id, external_id);
CREATE INDEX IF NOT EXISTS lp_room_events_page_start_idx ON lp_room_events (page_id, starts_at);
