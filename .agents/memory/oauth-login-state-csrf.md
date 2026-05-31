---
name: OAuth login-CSRF state nonce
description: How Google+GitHub OAuth state CSRF protection works and how to test the callback gate hermetically.
---

Both OAuth callbacks (`/auth/google/callback`, `/auth/github/callback`) must redeem a
server-stored single-use state nonce (`oauth_login_states` table, via
`lib/oauthState.ts` mint/redeem) BEFORE token exchange / session creation. The opaque
nonce is the ONLY thing in the provider `state` param; host/redirectUri/next live
server-side keyed by it (so they can't be tampered with either).

**Why:** the old flow base64url-decoded host/redirectUri/next out of `state` but never
bound it to anything we generated → forge/replay = login CSRF into an attacker-owned
session.

**How to apply:** redeem is `DELETE ... RETURNING` (atomic single-use); a missing/forged/
replayed/expired/wrong-provider nonce returns null and the callback fails closed to
`/?error=invalid_state`. Provider is part of the key (a google nonce can't redeem on the
github callback). Any new OAuth provider must mirror this mint-on-init + redeem-first.

**Hermetic callback test trick (no provider mocking):** the handler runs the state gate
FIRST, then the provider-config check immediately after. With the provider env UNSET, a
VALID state passes the gate (consuming the nonce) and falls through to
`/?error=oauth_not_configured` — never hitting the network; an INVALID state
short-circuits to `/?error=invalid_state`. Assert on those two error codes + nonce-row
consumption. See `auth.oauthState.integration.test.ts`.
