---
name: Invite-email host = canonical tenant host
description: Workspace/login email links must use the same canonical tenant host as post-login routing; managed tenants have no custom domain.
---

Invite / seat-activation emails must build their sign-in link from the SAME
canonical-tenant-host logic used by post-login auth routing
(`canonicalTenantHost` / `canonicalTenantSignInUrl` in api-server
`lib/tenantHosts.ts`), never an ad-hoc `domain ? https://domain : APP_URL`
ternary.

**Why:** a tenant's `domain` column is the CUSTOM domain only. Managed tenants
(the common case) have no custom domain — their workspace lives at
`<slug>.lpstudio.ai`. A domain-only ternary silently dropped every managed
tenant's invite link to the generic `app.lpstudio.ai`, so an invited member
landed on the wrong host and post-login routing followed that (wrong) origin
host. The real defect was the email host drifting away from the login canonical
host, which auth.ts already computed correctly.

**How to apply:** any place that emails a workspace/login link (invite, seat
activation, re-invite, tenant magic-link) must call
`canonicalTenantSignInUrl({domain, slug})` and therefore must SELECT the tenant
`slug`, not just `domain`. Fall back to `APP_URL ?? https://app.lpstudio.ai`
only when neither domain nor slug exists. Keep auth routing and the emails
importing the one shared helper so they can never diverge again. The Dandy-only
custom `fromEmail` sender stays keyed on the custom domain — that's the sender
identity, a separate concern from the link host.
