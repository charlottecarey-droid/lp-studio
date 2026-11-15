-- A team member's Google connection (read-only Calendar events + Docs), made
-- with the "Connect Google" button. The refresh token is stored encrypted.
-- A partner room reads its calendar and meeting notes through the connection
-- named in lp_room_settings.calendar_connection_id.
CREATE TABLE IF NOT EXISTS lp_google_connections (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL,
  user_id integer NOT NULL,
  user_email text NOT NULL,
  google_email text NOT NULL,
  refresh_token text NOT NULL,
  scopes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'connected',
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS lp_google_connections_tenant_user_uniq ON lp_google_connections (tenant_id, user_id);
ALTER TABLE lp_room_settings ADD COLUMN IF NOT EXISTS calendar_connection_id integer;
