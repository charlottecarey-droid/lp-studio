---
name: Branded email subdomain lifecycle & retirement
description: How Tier 2 branded subdomains provision/refresh/retire and the single shared deprovision path
---

Tier 2 branded email subdomains (`mail.<slug>.lpstudio.ai`) live entirely in
`lp_brand_settings.config.salesConsole`: `brandedEmailSubdomain`,
`brandedEmailSubdomainId` (Resend id), `brandedEmailSubdomainDnsRecordIds`
(Cloudflare record ids we own), `brandedEmailSubdomainProvisionedAt` (ISO clock),
`brandedSubdomainActive` (last observed verified bool).

**Rule:** there is exactly ONE deprovision implementation —
`deprovisionBrandedEmailSubdomain()` in `lib/brandedEmailSubdomain.ts`. Both the
wizard's DELETE route (`routes/lp/branded-email-subdomain.ts`) and the
background retirement sweep (`lib/brandedEmailSubdomainPoller.ts`) call it. The
read/persist/publish/unpublish helpers also live in that lib — don't re-inline
them in the route.

**Why:** abandoned/never-verifying provisions used to leak Resend domains +
Cloudflare DNS records because status only refreshed while the Settings wizard
was open. The sweep (advisory lock 787) refreshes status out-of-band and
auto-retires unverified subdomains past `BRANDED_SUBDOMAIN_STALE_THRESHOLD_HOURS`.

**How to apply:**
- The three domain pollers share a convention: `pg_try_advisory_lock(<taskNum>, 1)`
  (415 custom microsite TLS, 783 custom email domain verify, 787 branded subdomain
  retire) + per-process inflight guard + production-only `startXxxPoller`.
- Retirement FAILS CLOSED: a Resend outage (`available:false`) never retires.
- The staleness clock is stamped at provision time AND backfilled to now() on the
  sweep's first observation, so nothing is retired the instant we start watching.
- Active-state refresh uses a targeted `jsonb_set` scoped to the current domain id
  (not read-merge-write) to avoid clobbering concurrent brand-config edits.
