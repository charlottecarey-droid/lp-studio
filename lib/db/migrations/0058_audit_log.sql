-- General-purpose, system-wide audit trail for sensitive superadmin actions
-- (Task #672).
--
-- Consolidates the scattered, per-feature audit records: most sensitive
-- superadmin actions (tenant plan changes, plan-config edits, tenant-slug
-- redirect releases, custom-domain attach/detach, trial-phone releases) only
-- emitted `[admin][audit]` console lines that can't be reviewed in the UI and
-- rotate out of log retention. This append-only table gives one queryable place
-- to answer "what did superadmins do, across the whole system, and when".
--
-- Append-only — never updated or deleted by the app. Idempotent
-- (CREATE ... IF NOT EXISTS) so it is safe to re-run.
--
-- The privacy-scoped trial_phone_release_log and the email_template_edit_log
-- diff trail are intentionally kept as their own dedicated tables (see the
-- schema doc); this table records the action for the unified review surface.

CREATE TABLE IF NOT EXISTS audit_log (
  id            serial PRIMARY KEY,
  actor_user_id integer,
  actor_email   text,
  action        text NOT NULL,
  target_type   text,
  target_key    text,
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_log_created_idx
  ON audit_log (created_at);
CREATE INDEX IF NOT EXISTS audit_log_action_idx
  ON audit_log (action, created_at);
CREATE INDEX IF NOT EXISTS audit_log_target_idx
  ON audit_log (target_type, target_key, created_at);
