-- Partner Hubs: one Asana project and assignee for every hub's marketing
-- requests, set per workspace.
ALTER TABLE "lp_room_autocreate" ADD COLUMN IF NOT EXISTS "asana_project_gid" text;
ALTER TABLE "lp_room_autocreate" ADD COLUMN IF NOT EXISTS "asana_assignee_gid" text;
