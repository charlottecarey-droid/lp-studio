-- Task #637 — Trial phone gating: one free 14-day Growth trial per verified
-- phone number.
--
-- New self-serve signups must verify a mobile phone via an SMS code (Twilio
-- Verify) before a workspace + trial is created. A given phone number can only
-- ever unlock ONE trial window; subsequent signups from the same number get a
-- workspace on the free floor (no trial). VOIP/landline numbers are rejected
-- up front via Twilio Lookup, so they never reach these tables.
--
-- Only SHA-256 hashes of the normalized E.164 number are stored — never the raw
-- number — so a DB export can't be turned into a list of customer phone numbers.
--
-- All statements are idempotent (CREATE ... IF NOT EXISTS) — safe to re-run.

-- Source of truth for "has this phone already consumed a free trial".
-- One row per number that has ever been granted a trial window at signup.
CREATE TABLE IF NOT EXISTS trial_phone_numbers (
  phone_hash text PRIMARY KEY,
  -- The tenant this phone unlocked its trial for. SET NULL on tenant delete so
  -- the "already trialed" fact survives tenant cleanup (no second trial).
  tenant_id  integer REFERENCES tenants(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Short-lived, single-use "phone verified" tokens. Minted after a successful
-- Twilio Verify check and redeemed once during workspace creation. Only the
-- SHA-256 hash of the opaque token is stored; the raw token lives only in the
-- client between verify-code and signup.
CREATE TABLE IF NOT EXISTS trial_phone_tokens (
  token_hash text PRIMARY KEY,
  user_id    integer NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  -- SHA-256 hex of the verified E.164 number (same hashing as
  -- trial_phone_numbers) so signup can check/record the trial against it.
  phone_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trial_phone_tokens_user ON trial_phone_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_trial_phone_tokens_expires ON trial_phone_tokens (expires_at);
