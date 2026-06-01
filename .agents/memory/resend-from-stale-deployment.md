---
name: Resend platform-from stale deployment
description: Platform email "domain not verified" 403s whose named domain differs from the current RESEND_FROM_EMAIL value point at a stale deployment env, not code/DB.
---

The platform/system email From is `RESEND_FROM_EMAIL` (a plain env var, NOT a
secret) read at runtime by `platformFromAddress()`; fallback is
`LP Studio <team@mail.lpstudio.ai>`. Per-template `notification_templates.from_email`
overrides it only when non-null; both the dispatcher and the admin test-send use
`tpl.fromEmail || platformFromAddress()`.

**Symptom:** production Resend `403 "The <domain> domain is not verified"` where
`<domain>` does NOT match the current `RESEND_FROM_EMAIL` value (e.g. error names
apex `lpstudio.ai` while the env var + verified Resend domain are the subdomain
`mail.lpstudio.ai`, and every template's `from_email` is null).

**Why:** a deployment snapshots env vars at boot — it does not hot-reload. If the
sender was first deployed pointing at an unverified domain, then `RESEND_FROM_EMAIL`
was corrected afterward, the *running* deployment keeps serving the old value until
republished. Code only ever yields the env/fallback value, so a mismatch between
the 403's named domain and the on-disk env value is the tell.

**How to apply:** before chasing code/DB, compare the 403's domain against the live
`RESEND_FROM_EMAIL` (viewEnvVars) and the verified Resend domains. If they disagree
and templates carry no custom from, the fix is to **republish** (so the deployment
picks up the corrected sender) — not a code change. Resend treats subdomains as
distinct domains: verifying apex does not cover a subdomain or vice-versa; the From
domain must exactly match a verified domain. Reply-to domains need no verification.
