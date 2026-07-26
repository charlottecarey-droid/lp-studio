-- Agenda builder (July 2026): conference session catalogs + per-account
-- agendas, replacing hand-built per-account PowerPoints.
--
--   sales_events          — a conference/summit; catalog entered once.
--   sales_event_sessions  — the event's session catalog. tags jsonb drives
--                           deterministic matching; tags_edited_in_app stops
--                           re-imports from clobbering manual tag edits;
--                           source_key dedupes re-imports.
--   sales_event_agendas   — per-account artifact: attendee roles + ordered
--                           session selections + published lp_page id.
--                           account_id/lp_page_id are SET NULL on delete so
--                           agendas outlive account re-sync churn and page
--                           deletion (same contract as sales deletion tests).
--
-- Idempotent: CREATE TABLE/INDEX IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS sales_events (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  location text,
  start_date date,
  end_date date,
  source_url text,
  description text,
  status text NOT NULL DEFAULT 'draft',
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sales_events_tenant_idx
  ON sales_events (tenant_id);

CREATE TABLE IF NOT EXISTS sales_event_sessions (
  id serial PRIMARY KEY,
  event_id integer NOT NULL REFERENCES sales_events(id) ON DELETE CASCADE,
  tenant_id integer NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  day date,
  start_time text,
  end_time text,
  room text,
  session_type text,
  track text,
  speakers jsonb DEFAULT '[]',
  tags jsonb DEFAULT '{}',
  tags_edited_in_app boolean NOT NULL DEFAULT false,
  is_reserved_slot boolean NOT NULL DEFAULT false,
  source_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sales_event_sessions_event_idx
  ON sales_event_sessions (event_id, day, start_time);
-- Re-import upsert target: one row per source per event.
CREATE UNIQUE INDEX IF NOT EXISTS sales_event_sessions_source_key_idx
  ON sales_event_sessions (event_id, source_key)
  WHERE source_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS sales_event_agendas (
  id serial PRIMARY KEY,
  event_id integer NOT NULL REFERENCES sales_events(id) ON DELETE CASCADE,
  tenant_id integer NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  account_id integer REFERENCES sales_accounts(id) ON DELETE SET NULL,
  account_name_snapshot text,
  attendee_roles jsonb DEFAULT '[]',
  selections jsonb DEFAULT '[]',
  personal_note text,
  status text NOT NULL DEFAULT 'draft',
  lp_page_id integer REFERENCES lp_pages(id) ON DELETE SET NULL,
  published_at timestamptz,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sales_event_agendas_event_idx
  ON sales_event_agendas (event_id);
CREATE INDEX IF NOT EXISTS sales_event_agendas_account_idx
  ON sales_event_agendas (account_id);
