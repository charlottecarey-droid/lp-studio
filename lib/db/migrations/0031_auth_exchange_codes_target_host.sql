-- Bind cross-domain auth handoff exchange codes to the specific host they
-- were minted for. Without this, a code phished from one tenant's domain
-- could be redeemed on any other host the API serves (including an
-- attacker's domain), letting the attacker operate under a trusted hostname.
-- Nullable so any in-flight pre-migration codes still redeem until they
-- expire (5 min); new code paths populate it on issue and enforce on redeem.

ALTER TABLE auth_exchange_codes
  ADD COLUMN IF NOT EXISTS target_host text;
