-- Partner rooms: practices + Asana.
--   lp_room_practices            one row per practice (location) in a room's
--                                rollout: region, wave and where it stands.
--                                Filled from Salesforce child accounts or a
--                                pasted list; the customer sees it read-only.
--   lp_room_settings             + the Salesforce parent account the room is
--                                for, and an optional Asana project override.
--   lp_room_requests             + the Asana task created for a request.
CREATE TABLE IF NOT EXISTS lp_room_practices (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL,
  page_id integer NOT NULL,
  external_id text,
  name text NOT NULL,
  region text,
  city text,
  state text,
  wave text,
  stage text NOT NULL DEFAULT 'not_started',
  training_date text,
  live_date text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lp_room_practices_page_idx ON lp_room_practices (page_id, region);
CREATE UNIQUE INDEX IF NOT EXISTS lp_room_practices_page_ext_uniq ON lp_room_practices (page_id, external_id) WHERE external_id IS NOT NULL;

ALTER TABLE lp_room_settings ADD COLUMN IF NOT EXISTS sfdc_account_id text;
ALTER TABLE lp_room_settings ADD COLUMN IF NOT EXISTS asana_project_gid text;
ALTER TABLE lp_room_requests ADD COLUMN IF NOT EXISTS asana_task_gid text;
