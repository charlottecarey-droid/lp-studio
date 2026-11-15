-- Partner rooms, next modules:
--   lp_room_choices       a decision the customer made on the page (which
--                         marketing programs to include, a credit amount, an
--                         event format). One row per (page, key).
--   lp_room_contacts      people the customer added to their side of the team.
--   lp_room_wins          the wins feed: posts by either side.
--   lp_room_win_likes     one like per person per win.
--   lp_room_win_comments  comments on a win.
CREATE TABLE IF NOT EXISTS lp_room_choices (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL,
  page_id integer NOT NULL,
  choice_key text NOT NULL,
  value text NOT NULL,
  chosen_by_email text NOT NULL,
  chosen_by_name text,
  chosen_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS lp_room_choices_page_key_uniq ON lp_room_choices (page_id, choice_key);

CREATE TABLE IF NOT EXISTS lp_room_contacts (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL,
  page_id integer NOT NULL,
  name text NOT NULL,
  role text,
  email text,
  added_by_email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lp_room_contacts_page_idx ON lp_room_contacts (page_id);

CREATE TABLE IF NOT EXISTS lp_room_wins (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL,
  page_id integer NOT NULL,
  body text NOT NULL,
  headline text,
  region text,
  author_side text NOT NULL,
  author_email text NOT NULL,
  author_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lp_room_wins_page_created_idx ON lp_room_wins (page_id, created_at);

CREATE TABLE IF NOT EXISTS lp_room_win_likes (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL,
  win_id integer NOT NULL,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS lp_room_win_likes_win_email_uniq ON lp_room_win_likes (win_id, email);

CREATE TABLE IF NOT EXISTS lp_room_win_comments (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL,
  win_id integer NOT NULL,
  body text NOT NULL,
  author_side text NOT NULL,
  author_email text NOT NULL,
  author_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lp_room_win_comments_win_idx ON lp_room_win_comments (win_id, created_at);
