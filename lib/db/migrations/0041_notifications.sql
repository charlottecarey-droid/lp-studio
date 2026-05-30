-- In-app notifications + lifecycle email system.
--
-- Two tables:
--   notification_templates — SuperAdmin-editable overrides for each platform
--     message. Canonical copy + channels live in code; this table only stores
--     per-template overrides (enabled flag, subject, intro, in-app title/body).
--   notification_sends      — one row per (recipient, channel) delivery. Doubles
--     as the in-app inbox (channel='in_app' rows) and the dispatcher's
--     idempotency ledger (unique dedupe_key per channel).
--
-- Going-forward-only: this adds infrastructure only. Trial nudges fire off the
-- existing trial_started_at / trial_expires_at window, which is itself only set
-- for new self-serve signups — pre-trial-system accounts (NULL trial dates) are
-- never matched, so existing accounts are untouched.

CREATE TABLE IF NOT EXISTS notification_templates (
  key            text PRIMARY KEY,
  name           text NOT NULL,
  description    text NOT NULL DEFAULT '',
  category       text NOT NULL DEFAULT 'lifecycle',
  channels       jsonb NOT NULL DEFAULT '["in_app"]'::jsonb,
  email_subject  text,
  email_intro    text,
  email_cta_label text,
  in_app_title   text,
  in_app_body    text,
  enabled        boolean NOT NULL DEFAULT true,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notification_sends (
  id               serial PRIMARY KEY,
  tenant_id        integer REFERENCES tenants(id) ON DELETE CASCADE,
  app_user_id      integer REFERENCES app_users(id) ON DELETE CASCADE,
  recipient_email  text,
  template_key     text NOT NULL,
  channel          text NOT NULL,
  status           text NOT NULL DEFAULT 'pending',
  title            text,
  subject          text,
  body             text,
  cta_url          text,
  cta_label        text,
  dedupe_key       text NOT NULL,
  read_at          timestamptz,
  sent_at          timestamptz,
  error            text,
  metadata         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS notification_sends_dedupe_channel_idx
  ON notification_sends (dedupe_key, channel);
CREATE INDEX IF NOT EXISTS notification_sends_inbox_idx
  ON notification_sends (app_user_id, channel, created_at);
CREATE INDEX IF NOT EXISTS notification_sends_tenant_idx
  ON notification_sends (tenant_id);

-- Seed the default template rows. Copy/channels mirror the code registry in
-- artifacts/api-server/src/lib/notificationTemplates.ts; the dispatcher falls
-- back to that registry for any missing column or missing row, so these seeds
-- are an editable starting point, not the source of truth. ON CONFLICT DO
-- NOTHING keeps re-runs and operator edits safe.
INSERT INTO notification_templates
  (key, name, description, category, channels, email_subject, email_intro, email_cta_label, in_app_title, in_app_body, enabled)
VALUES
  (
    'welcome',
    'Welcome',
    'Sent when a new workspace finishes onboarding.',
    'lifecycle',
    '["in_app"]'::jsonb,
    'Welcome to {{tenantName}} on LP Studio',
    'Your workspace is ready. Bookmark your URL — it''s how you and your teammates sign back in.',
    'Open my workspace',
    'Welcome to LP Studio 🎉',
    'Your {{tenantName}} workspace is ready. Take a tour, invite your team, and publish your first page.',
    true
  ),
  (
    'trial_day_7',
    'Trial — day 7 (halfway)',
    'Halfway nudge: 7 days into the 14-day Growth trial.',
    'lifecycle',
    '["email","in_app"]'::jsonb,
    'You''re halfway through your {{tenantName}} Growth trial',
    'You''re halfway through your 14-day Growth trial. Pages, Sales Console, and AI generation are all unlocked — here''s a good moment to put them to work.',
    'Explore Growth features',
    'Halfway through your Growth trial',
    'You have {{daysRemaining}} days left on your Growth trial. Make the most of unlimited pages, Sales Console, and AI generation.',
    true
  ),
  (
    'trial_day_11',
    'Trial — day 11 (3 days left)',
    'Reminder: 3 days remain on the Growth trial.',
    'lifecycle',
    '["email","in_app"]'::jsonb,
    'Your {{tenantName}} Growth trial ends in {{daysRemaining}} days',
    'Your Growth trial ends in {{daysRemaining}} days. Add a plan now to keep Sales Console, unlimited pages, and AI generation without interruption.',
    'Choose a plan',
    'Your Growth trial ends soon',
    'Only {{daysRemaining}} days left on your Growth trial. Upgrade to keep your Growth features when it ends.',
    true
  ),
  (
    'trial_day_13',
    'Trial — day 13 (last day)',
    'Final nudge: trial ends tomorrow.',
    'lifecycle',
    '["email","in_app"]'::jsonb,
    'Last day of your {{tenantName}} Growth trial',
    'This is the last day of your Growth trial. Once it ends you''ll drop to the Free plan — upgrade now to keep Sales Console, unlimited pages, and AI generation.',
    'Upgrade to keep your features',
    'Your Growth trial ends tomorrow',
    'Your Growth trial ends tomorrow. Upgrade now to avoid dropping to the Free plan and losing your Growth features.',
    true
  )
ON CONFLICT (key) DO NOTHING;
