---
name: Prod boot guards can block the NEXT publish
description: api-server top-level fail-fast throws run before app.listen; a guard added after a good publish silently blocks the next deploy at the startup port probe.
---

The lp-studio api-server (`artifacts/api-server/src/server.ts`) has a stack of
top-level `throw new Error(...)` fail-fast checks that run in production
**before** `app.listen`. Each refuses to boot when its required secret/env is
absent: TURNSTILE_SECRET_KEY, GITHUB_OAUTH_REDIRECT_URI, GOOGLE_REDIRECT_URI,
UNSUB_SECRET, RESEND_WEBHOOK_SECRET, CREDENTIAL_ENCRYPTION_KEY (+ base64/32-byte
validity). The GitHub/Google redirect guards only fire when that provider's
client id AND secret are both set.

**Why this bites:** a NEW guard (or newly-enabling a provider, e.g. setting
GitHub client id/secret) added *after* a successful publish blocks the *next*
publish. The build succeeds, but the process throws before opening port 8080, so
the deploy fails with "a port configuration was specified but the required port
was never opened" / "not all artifact ports opened within timeout" / SIGTERM.
Failed deploys do NOT promote, so `fetch_deployment_logs` returns nothing and the
underlying throw is only visible in the raw deploy console the user can paste.

**How to diagnose (fast, zero side effects):** evaluate the guard conditions
against the env under `NODE_ENV=production` with a plain `node -e` that imports
NOTHING from the app (no DB/pollers/Stripe). `git log` the api-server boot files
to see which guards landed since the last `"Published your App"` commit — those
are the suspects.

**How to fix:** supply the missing config in the production deployment.
Redirect URIs are non-secret URLs, so set them directly via the
environment-secrets `setEnvVars({environment:"production"})` (scope to
production so dev keeps deriving the callback from the request host). The guard
checks PRESENCE only, not correctness — a wrong-but-present redirect URI still
boots (login may 400 at runtime; that's a separate concern). The server.ts error
strings carry the canonical values, e.g. GitHub →
`https://app.lpstudio.ai/api/auth/github/callback`.

**Note on env visibility:** the agent shell env, the `viewEnvVars` (code
sandbox) store, and the deployment store can disagree. Trust the guard-eval +
git-history reasoning over a single `viewEnvVars` snapshot.
