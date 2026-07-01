---
name: Tenant-facing URL host = canonical tenant host
description: Build every tenant-facing workspace URL (invite emails, Stripe checkout/portal return) from the shared canonical tenant host, never from a domain-only ternary or the request Host header.
---

Any tenant-facing "go to your workspace" URL — invite / seat-activation email
links, Stripe Checkout `success_url` / `cancel_url`, Billing Portal
`return_url`, dunning-email billing links — must build its host from the shared
canonical-tenant-host helpers in api-server `lib/tenantHosts.ts`
(`canonicalTenantHost({domain, slug})` / `canonicalTenantSignInUrl(...)`):
custom `domain` wins, else managed `<slug>.lpstudio.ai`, else
`APP_URL ?? https://app.lpstudio.ai`.

Two wrong sources that BOTH reproduce the bug:
1. `domain ? https://domain : APP_URL` — `domain` is the CUSTOM domain only, so
   managed tenants (no custom domain) silently drop to the generic
   `app.lpstudio.ai`. (Fixed in invite emails; still latent in stripeWebhook.ts
   dunning `billingUrl`, and historically trialLifecycle.ts.)
2. `req.get("host")` — in production the tenant host is fronted by a
   Cloudflare worker/proxy that rewrites the incoming Host header to the RAW
   origin deployment host (`*.replit.app`), so a header-derived URL sends the
   operator to `something.replit.app` instead of their workspace. (This was the
   Stripe Checkout / Portal return-URL bug.)

**Why:** the email/redirect host kept drifting away from the host that auth
post-login routing already computes correctly; unifying on the one helper is the
only thing that stops the bug being reintroduced surface by surface.

**How to apply:** to emit a tenant workspace URL, load the tenant's `domain`
AND `slug` (add both to any SELECT that feeds a URL builder) and call the shared
helper. Never read the request Host header for tenant-facing links. The
Dandy-only custom `fromEmail` sender stays keyed on the custom domain on purpose
— that's sender identity, separate from the link host.
