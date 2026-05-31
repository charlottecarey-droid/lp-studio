---
name: Trial phone verification gate
description: How the one-trial-per-phone SMS gate is wired and why it fails safe when Twilio is absent.
---

# Trial phone verification gate (Twilio Verify)

Limits one free 14-day Growth trial per SMS-verified mobile phone at signup.

## Fail-safe-OFF on config
The entire gate is gated on `twilioConfigured()` (needs `TWILIO_ACCOUNT_SID` +
`TWILIO_AUTH_TOKEN` + `TWILIO_VERIFY_SERVICE_SID`). When ANY is missing:
- `/auth/phone/config` returns `{required:false}` and the frontend skips the
  phone step entirely;
- `/auth/signup` grants the trial exactly as before (no token needed);
- phone send/verify endpoints 503.

**Why:** dev + e2e environments have no Twilio secrets, so the legacy signup +
trial path must stay byte-for-byte intact there. Never make signup hard-require
a phone token unconditionally — gate every new requirement on `twilioConfigured()`.

## Client echoes canonical E.164 — and that's safe
`send-code` returns the canonical E.164 from Twilio Lookup; the client sends that
same string back to `verify-code`. Trusting the client-supplied phone here is safe
because Twilio only ever approves a code for a number that *started* verification
through our `send-code` (which rejects VOIP/landline via Lookup line-type). A forged
number can't pass the Verify check.

## e2e inherits real secrets — neutralize in playwright.config.ts
The Playwright `webServer` api-server inherits the parent process env, which DOES
carry the real Twilio secrets once they're added (Playwright `env` only
adds/overrides keys, so it never strips inherited ones). A secret-gated feature
that changes a legacy flow will therefore activate inside e2e and break specs
that don't expect it. Fix: explicitly set the gating secrets to `""` in the
api-server `webServer.env` so the feature stays OFF in tests. (Here:
TWILIO_ACCOUNT_SID/AUTH_TOKEN/VERIFY_SERVICE_SID = "".)

Also: adding a field to the signup request body breaks any spec asserting the
exact payload with `toEqual` (post-login-workspace-screens captures and deep-
equals it) — update those assertions in lockstep.

## Atomicity
Signup redeems the single-use phone-verified token, checks `hasPhoneTrialed`, and
branches the tenant INSERT (real trial window vs NULL/NULL free floor) all inside
the same tx; `recordPhoneTrial` runs after the insert. Token redeem failure =
ROLLBACK + 400 with `code:"phone_verification_required"` so the client re-verifies.
