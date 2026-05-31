-- Durable audit trail for superadmin trial-phone lookups (Task #673).
--
-- Support can look up a phone number (POST /superadmin/trial-phones/lookup) to
-- check whether it has already used a free trial and, when it has, release it.
-- The release is already audited (trial_phone_release_log), but the lookup that
-- precedes it was not recorded at all — so there was no durable trace of WHO
-- probed a number, only of who released it. This append-only table records each
-- lookup (who, which hash, whether it matched, and the matched-tenant snapshot)
-- so a release is traceable back to the operator who looked it up, and so
-- probing itself is reviewable (deters misuse).
--
-- Only the SHA-256 HASH of the number is stored (phone_hash), never the raw
-- number — same privacy contract as trial_phone_numbers / the release log. The
-- matched-tenant name/slug are SNAPSHOTTED at lookup time (plain columns, no FK)
-- so the history stays readable even after that tenant is deleted. Idempotent
-- (CREATE ... IF NOT EXISTS) — safe to re-run.

CREATE TABLE IF NOT EXISTS trial_phone_lookup_log (
  id                   serial PRIMARY KEY,
  phone_hash           text NOT NULL,
  found                boolean NOT NULL,
  matched_tenant_id    integer,
  matched_tenant_name  text,
  matched_tenant_slug  text,
  actor_user_id        integer,
  actor_email          text,
  looked_up_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trial_phone_lookup_log_looked_up_idx
  ON trial_phone_lookup_log (looked_up_at);
CREATE INDEX IF NOT EXISTS trial_phone_lookup_log_hash_idx
  ON trial_phone_lookup_log (phone_hash);
