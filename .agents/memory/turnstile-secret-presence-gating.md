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

**Diagnostic signature (any api-server prod boot-guard throw, not just Turnstile):**
the deployment build is marked `failed` but the BUILD logs look clean and just END
at "Creating Autoscale service" — the real error is only in RUNTIME deployment logs
(`fetchDeploymentLogs`), showing `healthcheck /api returned status 500` (repeating),
`not all artifact ports opened within timeout expected=[8080] detected=0`,
`artifact process exited with error artifact=artifacts/api-server error=exit status 1`,
and the explicit `Error: <VAR> is not set on the production deployment`. server.ts
has a family of unconditional prod guards (TURNSTILE_SECRET_KEY, UNSUB_SECRET,
RESEND_WEBHOOK_SECRET, CREDENTIAL_ENCRYPTION_KEY) + conditional OAuth-redirect guards
(GITHUB_OAUTH_REDIRECT_URI / GOOGLE_REDIRECT_URI, fire only when that provider's
client id+secret are set). Fix is operational: ensure the secret is in prod Secrets,
then republish — no code change.
