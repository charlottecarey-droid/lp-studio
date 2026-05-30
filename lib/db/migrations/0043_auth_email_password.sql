-- Email + password and passwordless (magic-link) authentication support.
--
-- Adds the per-user credential columns and the single-use email-token table
-- backing the magic-link / password-reset / email-verification flows. This
-- extends the existing custom auth (Google OAuth + admin-password fallback) —
-- it does not replace it.
--
-- All statements are idempotent — safe to re-run.

-- Per-user credential fields on app_users.
-- password_hash is NULL for accounts that authenticate only via Google / magic
-- link. email_verified gates password login until the inbox is proven.
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS password_hash text;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false;

-- Backfill: existing Google-linked accounts have proven their email via Google,
-- so mark them verified. Brand-new password registrations start unverified.
UPDATE app_users SET email_verified = true WHERE google_id IS NOT NULL AND email_verified = false;

-- Single-use, short-lived email tokens. Only the SHA-256 hash of the opaque
-- token is stored; the raw token lives only in the emailed link.
CREATE TABLE IF NOT EXISTS auth_email_tokens (
  token_hash  text PRIMARY KEY,
  user_id     integer NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  purpose     text NOT NULL,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  target_host text,
  next_path   text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_email_tokens_user_purpose ON auth_email_tokens (user_id, purpose);
CREATE INDEX IF NOT EXISTS idx_auth_email_tokens_expires ON auth_email_tokens (expires_at);
