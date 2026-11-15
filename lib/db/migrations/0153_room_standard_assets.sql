-- Partner rooms: launch-kit files that are the same for every customer (the
-- Practice Welcome Guide, the Success Guide). Uploaded once per workspace and
-- added to each room's launch kit; a room can still carry its own file.
CREATE TABLE IF NOT EXISTS lp_room_standard_assets (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL,
  asset_key text NOT NULL,
  title text NOT NULL,
  description text,
  file_url text NOT NULL,
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS lp_room_standard_assets_tenant_key_uniq ON lp_room_standard_assets (tenant_id, asset_key);
