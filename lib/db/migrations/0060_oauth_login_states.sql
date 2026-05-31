-- OAuth login CSRF hardening: server-stored single-use state nonces.
--
-- Both the Google and GitHub OAuth login flows previously embedded the origin
-- host / redirect URI / next path in a base64url `state` blob that was decoded
-- but never bound to a server-side secret, so an attacker could forge a `state`
-- (or replay a captured one) and drive a victim's browser into an
-- attacker-owned authenticated session (login CSRF). We now mint a
-- cryptographically random nonce on initiation, store the flow context here
-- keyed by that nonce, and redeem it single-use (DELETE ... RETURNING) in the
-- callback BEFORE any token exchange / session creation. Missing, forged,
-- replayed, or expired nonces fail closed.

CREATE TABLE IF NOT EXISTS oauth_login_states (
  state text PRIMARY KEY,
  provider text NOT NULL,
  host text NOT NULL DEFAULT '',
  redirect_uri text NOT NULL DEFAULT '',
  next_path text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oauth_login_states_expires
  ON oauth_login_states (expires_at);
