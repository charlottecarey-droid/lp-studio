-- Durable audit trail for superadmin trial-phone releases (Task #669).
--
-- Releasing a gated trial phone DELETEs its row from trial_phone_numbers, so
-- the only prior record was a structured server-log line that can't be reviewed
-- in the UI and rotates out of retention. This append-only table preserves
-- who released what and when so support can review past releases.
--
-- Only the SHA-256 HASH of the number is stored (phone_hash), never the raw
-- number — same privacy contract as trial_phone_numbers. The prior-tenant
-- name/slug are SNAPSHOTTED at release time (plain columns, no FK) so the
-- history stays readable even after that tenant is deleted. Idempotent
-- (CREATE ... IF NOT EXISTS) — safe to re-run.

CREATE TABLE IF NOT EXISTS trial_phone_release_log (
  id                  serial PRIMARY KEY,
  phone_hash          text NOT NULL,
  prior_tenant_id     integer,
  prior_tenant_name   text,
  prior_tenant_slug   text,
  original_created_at timestamptz,
  actor_user_id       integer,
  actor_email         text,
  released_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trial_phone_release_log_released_idx
  ON trial_phone_release_log (released_at);
CREATE INDEX IF NOT EXISTS trial_phone_release_log_hash_idx
  ON trial_phone_release_log (phone_hash);
