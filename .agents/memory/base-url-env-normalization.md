---
name: Base-URL env vars normalized in loadEnv
description: Hand-pasted base-URL secrets carry whitespace/trailing slashes; loadEnv trims them; prod Stripe webhook needs production-scoped PUBLIC_API_BASE_URL.
---

Rule: `API_BASE_URL`, `APP_BASE_URL`, and `PUBLIC_API_BASE_URL` are normalized
(trim whitespace + strip trailing slashes) in api-server `loadEnv.ts`, in ALL
environments, after the dev-only block. Any new base-URL-style env var that
gets concatenated into OAuth redirect URIs or webhook URLs should be added to
that same loop.

**Why:** These values are hand-pasted into the Secrets pane. A leading space in
`API_BASE_URL` produced `" https://app.lpstudio.ai/api/sales/slack/callback"`
and Slack rejected it with an opaque "redirect_uri did not match" (July 2026).
The error gives no hint the URI is malformed.

**How to apply:**
- Prod Stripe managed webhook base = `PUBLIC_API_BASE_URL ?? REPLIT_DEV_DOMAIN`
  (stripeClient.ts). In deployments REPLIT_DEV_DOMAIN resolves to an ephemeral
  janeway.replit.dev domain, so the webhook silently registers against a dead
  host unless production-scoped `PUBLIC_API_BASE_URL=https://app.lpstudio.ai`
  is set (it lives in `.replit [userenv.production]`).
- `API_BASE_URL`/`APP_BASE_URL` are GLOBAL secrets shared dev+prod → dev
  OAuth connect flows redirect through the prod host by design.
- Env/secret changes only reach prod at the NEXT publish; a publish already in
  flight when the value changes ships the old value. Verify after boot via the
  "[stripe] managed webhook ensured" log line's url.
