-- Partner rooms (Nov 2026): the working state behind a customer-facing room
-- page. The page's blocks define the tasks; these tables hold who may act,
-- which tasks the customer completed and the files they handed over.
-- No FK to lp_pages: deleting a page must not destroy customer uploads.
CREATE TABLE IF NOT EXISTS lp_room_settings (
  page_id integer PRIMARY KEY,
  tenant_id integer NOT NULL,
  allowed_domains jsonb NOT NULL DEFAULT '[]'::jsonb,
  slack_channel_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lp_room_members (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL,
  page_id integer NOT NULL,
  email text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS lp_room_members_page_email_uniq ON lp_room_members (page_id, email);

CREATE TABLE IF NOT EXISTS lp_room_task_state (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL,
  page_id integer NOT NULL,
  task_key text NOT NULL,
  completed_by_email text NOT NULL,
  completed_by_name text,
  completed_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS lp_room_task_state_page_task_uniq ON lp_room_task_state (page_id, task_key);

CREATE TABLE IF NOT EXISTS lp_room_uploads (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL,
  page_id integer NOT NULL,
  task_key text NOT NULL,
  file_name text NOT NULL,
  content_type text NOT NULL,
  size_bytes integer NOT NULL,
  object_path text NOT NULL,
  uploaded_by_email text NOT NULL,
  uploaded_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lp_room_uploads_page_created_idx ON lp_room_uploads (page_id, created_at);
