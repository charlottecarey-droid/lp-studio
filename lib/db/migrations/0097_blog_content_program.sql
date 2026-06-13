-- June 2026 — LP Studio blog Phase 4 (autonomous publishing / content program).
--
-- Additive only. Adds the strategic content-program substrate that lets the
-- superadmin maintain a 30–90 day publishing backlog with minimal manual work
-- while preserving editorial oversight (REVIEW mode is the default; autopublish
-- is OFF by default; the autonomous pipeline only ever acts on PRE-APPROVED
-- topics within explicit guardrails). Nothing here is tenant-scoped — like
-- blog_posts it is superadmin-owned platform marketing config.
--
-- Tables:
--   * blog_content_themes    — the strategic guardrails. Each theme is a
--     content pillar with a priority, target keywords, and an audience; topic
--     recommendations are generated from the ACTIVE themes.
--   * blog_topics            — the topic pipeline/queue. AI- or manually-sourced
--     topics move through a status machine (suggested → approved/rejected →
--     drafting → drafted → scheduled → published). A blog_posts DRAFT is created
--     when an APPROVED topic is generated; the post links back via topic_id.
--   * blog_program_settings  — singleton (id=1) program config + guardrails:
--     mode (review|autonomous), cadence (posts/week + target backlog days),
--     publish day/time window, max_autonomous_per_week cap, and the
--     autopublish_enabled bool (default FALSE — the strongest oversight gate).
--
-- Also links generated posts back to their originating topic:
--   * blog_posts.topic_id    — nullable FK-by-convention to blog_topics.id.
--
-- Everything is IF NOT EXISTS / ADD COLUMN IF NOT EXISTS so it is safe to
-- re-run and pairs with the marker-gated self-heal in api-server migrate.ts
-- (blog_content_program_phase4). Public read endpoints are unchanged — they
-- still serve only blog_posts.status='published'; none of these program tables
-- are ever read on the public path.

CREATE TABLE IF NOT EXISTS blog_content_themes (
  id               serial PRIMARY KEY,
  name             text NOT NULL,
  description      text NOT NULL DEFAULT '',
  -- Higher = pursued first when topping up recommendations / picking what to
  -- draft next. 1 (low) … 5 (high); default 3.
  priority         integer NOT NULL DEFAULT 3,
  target_keywords  jsonb NOT NULL DEFAULT '[]'::jsonb,
  audience         text NOT NULL DEFAULT '',
  active           boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS blog_content_themes_active_idx
  ON blog_content_themes (active, priority);

CREATE TABLE IF NOT EXISTS blog_topics (
  id               serial PRIMARY KEY,
  -- Nullable: a manual topic need not belong to a theme; a theme deletion
  -- nulls the link rather than cascading away the topic's editorial history.
  theme_id         integer REFERENCES blog_content_themes(id) ON DELETE SET NULL,
  title            text NOT NULL,
  -- Author's angle / editor notes — the brief that grounds the draft.
  angle            text NOT NULL DEFAULT '',
  target_keyword   text NOT NULL DEFAULT '',
  -- suggested | approved | rejected | drafting | drafted | scheduled | published
  status           text NOT NULL DEFAULT 'suggested',
  -- 'ai' | 'manual' — provenance for the audit trail.
  source           text NOT NULL DEFAULT 'ai',
  -- Why the AI suggested it (or the human's note). Editable.
  rationale        text NOT NULL DEFAULT '',
  -- The blog_posts row generated from this topic, once drafted (nullable until).
  post_id          integer,
  created_at       timestamptz NOT NULL DEFAULT now(),
  -- When the approve/reject decision was taken + by whom (audit).
  decided_at       timestamptz,
  decided_by       text,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS blog_topics_status_idx ON blog_topics (status, created_at);
CREATE INDEX IF NOT EXISTS blog_topics_theme_idx ON blog_topics (theme_id);

-- Singleton program-settings row (id=1, enforced in-app via ON CONFLICT). One
-- row holds the whole program config + guardrails. Defaults are the SAFEST
-- posture: REVIEW mode + autopublish OFF, so a fresh DB never autonomously
-- publishes anything.
CREATE TABLE IF NOT EXISTS blog_program_settings (
  id                       integer PRIMARY KEY DEFAULT 1,
  -- 'review' (default, safest) | 'autonomous'.
  mode                     text NOT NULL DEFAULT 'review',
  -- Cadence: posts per week + the backlog window the program tries to keep
  -- filled (clamped 30–90 days in-app).
  posts_per_week           integer NOT NULL DEFAULT 2,
  target_backlog_days      integer NOT NULL DEFAULT 45,
  -- Publish-window guardrails: which weekdays (0=Sun … 6=Sat) and what local
  -- hour posts may be scheduled at.
  publish_days             jsonb NOT NULL DEFAULT '[2,4]'::jsonb,
  publish_hour             integer NOT NULL DEFAULT 9,
  -- Hard cap on how many posts the autonomous pipeline may produce/schedule in
  -- a rolling week — never exceeded regardless of backlog gap.
  max_autonomous_per_week  integer NOT NULL DEFAULT 3,
  -- THE strongest oversight gate. When FALSE (default), the autonomous pipeline
  -- may generate + schedule but the scheduled posts are NOT auto-published —
  -- the blogPublishPoller is allowed to flip them only when this is TRUE.
  autopublish_enabled      boolean NOT NULL DEFAULT false,
  -- Optional default theme to weight recommendations toward (nullable).
  default_theme_id         integer REFERENCES blog_content_themes(id) ON DELETE SET NULL,
  updated_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blog_program_settings_singleton CHECK (id = 1)
);

-- Link generated posts back to their originating topic (additive, nullable).
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS topic_id integer;
CREATE INDEX IF NOT EXISTS blog_posts_topic_idx ON blog_posts (topic_id);
