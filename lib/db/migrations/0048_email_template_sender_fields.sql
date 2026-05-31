-- Sender envelope fields for notification_templates (platform + tenant rows).
--
-- Adds operator-editable control over the email envelope:
--   - from_email      : sender display name / from address override (Resend `from`).
--   - reply_to        : address replies route to (Resend `reply_to`).
--   - preheader_text  : inbox preview text (preheader) shown after the subject.
--
-- All columns are NULLable overrides (NULL = use the code/env default): a missing
-- value falls back to today's behavior (env RESEND_FROM_EMAIL, no reply-to,
-- preheader derived from the intro) so existing unedited templates render
-- byte-identically. Shared by both scope='platform' and scope='tenant' rows.
-- Idempotent — safe to re-run.

ALTER TABLE notification_templates ADD COLUMN IF NOT EXISTS from_email text;
ALTER TABLE notification_templates ADD COLUMN IF NOT EXISTS reply_to text;
ALTER TABLE notification_templates ADD COLUMN IF NOT EXISTS preheader_text text;
