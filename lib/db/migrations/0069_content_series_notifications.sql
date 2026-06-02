-- Content Series episode-notification bookkeeping (Task #806).
--
-- Backs the "email subscribers about new episodes" feature on the Content
-- Series landing-page block. An episode key is the block's stable per-episode
-- id (slug -> rssGuid -> slugified title); a subscriber is a lead captured via
-- the block's built-in Subscribe form (lp_leads.fields._source =
-- 'content-series-subscribe') on that page.

-- Page-level "have we seen this episode before" baseline. Drives new-episode
-- detection on (re)publish: an episode is NEW only when its key is absent here.
-- Recorded for the full current set on every publish so toggling auto-send on
-- later never blasts pre-existing episodes.
CREATE TABLE IF NOT EXISTS content_series_seen_episodes (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL,
  page_id integer NOT NULL REFERENCES lp_pages(id) ON DELETE CASCADE,
  episode_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS content_series_seen_page_episode_idx
  ON content_series_seen_episodes (page_id, episode_key);
CREATE INDEX IF NOT EXISTS content_series_seen_page_idx
  ON content_series_seen_episodes (page_id);

-- Per-recipient send ledger. One row per (page, episode key, recipient email)
-- guarantees at-most-once delivery per episode per subscriber across
-- re-publishes and manual re-sends.
CREATE TABLE IF NOT EXISTS content_series_episode_sends (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL,
  page_id integer NOT NULL REFERENCES lp_pages(id) ON DELETE CASCADE,
  episode_key text NOT NULL,
  recipient_email text NOT NULL,
  lead_id integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS content_series_sends_page_episode_email_idx
  ON content_series_episode_sends (page_id, episode_key, recipient_email);
CREATE INDEX IF NOT EXISTS content_series_sends_page_idx
  ON content_series_episode_sends (page_id);

-- Per-page lead opt-out list. A subscriber who clicks unsubscribe in an episode
-- email is excluded from all future episode emails for that page.
CREATE TABLE IF NOT EXISTS content_series_unsubscribes (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL,
  page_id integer NOT NULL REFERENCES lp_pages(id) ON DELETE CASCADE,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS content_series_unsub_page_email_idx
  ON content_series_unsubscribes (page_id, email);
CREATE INDEX IF NOT EXISTS content_series_unsub_page_idx
  ON content_series_unsubscribes (page_id);
