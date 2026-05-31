-- Task #623 — reusable, self-updating recipient GROUPS for broadcast alerts.
--
-- Alongside the explicit `member_user_ids` + `extra_emails`, a config row may now
-- carry a set of dynamic group tokens that resolve to the CURRENT roster at send
-- time (so adding/removing a teammate later automatically changes who is alerted,
-- with no re-edit of the config):
--
--   - all_admins  → every accepted workspace admin (current emails)
--   - all_members → every workspace member with an email (current emails)
--   - page_author → the creator/submitter of the specific page that triggered a
--                   page-scoped collaboration alert (comment / review_decision);
--                   a no-op for account/billing alert types.
--
-- The final audience is the UNION of expanded groups + selected members + extra
-- emails, deduped by email. Existing rows default to '[]' (no groups), so this is
-- a no-op for every tenant until they opt a group in.
ALTER TABLE broadcast_alert_recipients
  ADD COLUMN IF NOT EXISTS groups jsonb NOT NULL DEFAULT '[]'::jsonb; -- token[]
