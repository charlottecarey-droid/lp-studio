---
name: Turnstile secret-presence gating spans dev + e2e
description: Why adding the Turnstile (or similar challenge) secret globally needs the paired public key AND an e2e neutralization, not just a prod publish fix.
---

Cloudflare Turnstile is gated ONLY by the presence of `TURNSTILE_SECRET_KEY`
(`turnstileConfigured()` = `!!process.env.TURNSTILE_SECRET_KEY`). The api-server
also has a production boot guard that REFUSES to start if the secret is missing,
so a publish fails at the startup probe (promote phase, not build) with
"TURNSTILE_SECRET_KEY is not set on the production deployment" — looks like a
build failure but is a startup crash.

**Why this is a trap:** Replit Secrets are GLOBAL (not env-scoped). Adding the
secret to fix the publish immediately flips Turnstile ON in development AND in
the e2e webServer too. Once configured, `verifyTurnstile` rejects any
register/login/password-reset request without a valid token.

**How to apply — the secret is one of a required trio:**
1. `TURNSTILE_SECRET_KEY` (secret) — server-side verify + unblocks the prod boot guard.
2. `TURNSTILE_SITE_KEY` (public; store as a shared env var) — served by
   `GET /api/auth/turnstile-config`; the frontend (`useTurnstileSiteKey`) only
   renders the widget / produces a token when this is present. Secret WITHOUT
   site key = auth fully blocked (browser can't make a token).
3. `playwright.config.ts` webServer env must set `TURNSTILE_SECRET_KEY: ""`
   (same pattern as the `TWILIO_*: ""` neutralization) — headless tests can't
   solve a real Cloudflare challenge, so e2e must keep the legacy no-challenge path.

Same shape applies to any other "configured = secret present" gate (e.g. Twilio
phone verification): adding the secret globally changes dev/e2e behavior, so pair
it with the public key and an e2e opt-out in the same change.
