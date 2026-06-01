---
name: Published LP URLs must use tenant-resolving host
description: getLpPageUrl must build from the tenant's canonical host, never window.location.origin, or live links 404
---

Published landing pages are resolved per-tenant BY HOSTNAME (api-server
`findTenantByHost`). A page only loads on a host that maps to its tenant: the
tenant's microsite/custom domain, or its wildcard subdomain `<slug>.<base>`
(base = `WILDCARD_TENANT_BASE_HOSTS`, e.g. `lpstudio.ai`). The admin host the
editor browses (`app.lpstudio.ai`, `dev.lpstudio.ai`, Replit dev domain) has NO
tenant binding — `findTenantByHost` returns `mode:open, tenantId:null` — so any
public page URL built off `window.location.origin` 404s with "Page Not Found".

**Rule:** `getLpPageUrl(slug, micrositeDomain, tenantHost)` precedence is
micrositeDomain (`/<slug>` root) → tenantHost (`/lp/<slug>`) → origin fallback.
Every call site must pass `useAuth().user.tenantHost` (set by `/auth/me` =
custom domain else `<slug>.<publicWildcardBase>`). Leaf components without it in
scope (PageRow, AutoMetaButton) should call `useAuth()` directly rather than
prop-drill.

**Why:** the origin fallback silently produces admin-host `/lp/` links that
look right but never resolve. Symptom users report: "pages used to go to the
subdomain, now they go to /lp/ and 404."

**Note:** reserved subdomains (incl. `dev`) can never be a wildcard tenant slug,
and a host listed in WILDCARD_TENANT_BASE_HOSTS is rejected as a tenant domain
by `validateDomain` — so `dev.lpstudio.ai` cannot itself serve tenant pages.
