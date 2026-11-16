-- Automatic rooms: what else happens when a room is created.
--   alert_owner / alert_emails  email the account's owner (matched by name to
--                               a team member) and any other addresses
--   log_enabled / log_sheet_id / log_tab
--                               add a row to a sheet tab (default: the watched
--                               workbook, tab "Digital Sales Rooms")
--   sfdc_field                  write the room's link to this field on the
--                               Salesforce Account, when Salesforce is connected
ALTER TABLE lp_room_autocreate ADD COLUMN IF NOT EXISTS alert_owner boolean NOT NULL DEFAULT false;
ALTER TABLE lp_room_autocreate ADD COLUMN IF NOT EXISTS alert_emails jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE lp_room_autocreate ADD COLUMN IF NOT EXISTS log_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE lp_room_autocreate ADD COLUMN IF NOT EXISTS log_sheet_id text;
ALTER TABLE lp_room_autocreate ADD COLUMN IF NOT EXISTS log_tab text;
ALTER TABLE lp_room_autocreate ADD COLUMN IF NOT EXISTS sfdc_field text;
