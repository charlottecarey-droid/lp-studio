-- Partner rooms: requests a customer makes from the room ("Make a request",
-- "Request changes" on an asset). One row per request; the team moves it
-- through new -> in_progress -> review -> done and the customer watches the
-- status in the room's Requests module.
CREATE TABLE IF NOT EXISTS lp_room_requests (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL,
  page_id integer NOT NULL,
  kind text NOT NULL,
  subject text NOT NULL,
  details text,
  asset_key text,
  status text NOT NULL DEFAULT 'new',
  owner text,
  due text,
  requested_by_email text NOT NULL,
  requested_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lp_room_requests_page_created_idx ON lp_room_requests (page_id, created_at);
