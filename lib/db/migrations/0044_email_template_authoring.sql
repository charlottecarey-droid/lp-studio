-- Full email-template authoring (Phase 1).
--
-- Adds free-form body authoring + per-template shell control to
-- notification_templates, an editable branded-shell singleton, and an
-- append-only audit log for superadmin email edits.
--
-- All columns are NULLable overrides (NULL = use the code default), matching
-- the notification_templates / plan_config resilience contract: a missing
-- value or a DB hiccup falls back to code, never a broken email. All
-- statements are idempotent — safe to re-run.

-- notification_templates: free-form body + shell control + preview/test metadata.
ALTER TABLE notification_templates ADD COLUMN IF NOT EXISTS body_html text;
ALTER TABLE notification_templates ADD COLUMN IF NOT EXISTS body_mode text;
ALTER TABLE notification_templates ADD COLUMN IF NOT EXISTS wrap_in_shell boolean;
ALTER TABLE notification_templates ADD COLUMN IF NOT EXISTS preview_data jsonb;
ALTER TABLE notification_templates ADD COLUMN IF NOT EXISTS last_test_sent_at timestamptz;
ALTER TABLE notification_templates ADD COLUMN IF NOT EXISTS last_test_sent_by text;

-- Editable branded shell (platform singleton). NULL columns fall back to the
-- code default shell / brand pieces.
CREATE TABLE IF NOT EXISTS email_shell_templates (
  id          text PRIMARY KEY,
  shell_html  text,
  logo_html   text,
  header_bg   text,
  footer_html text,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  text
);

-- Append-only audit log for superadmin email-authoring actions.
CREATE TABLE IF NOT EXISTS email_template_edit_log (
  id           serial PRIMARY KEY,
  target_type  text NOT NULL,
  target_key   text NOT NULL,
  editor_email text,
  action       text NOT NULL,
  diff         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_template_edit_log_target_idx
  ON email_template_edit_log (target_type, target_key, created_at);
