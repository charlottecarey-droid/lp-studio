---
name: Managed LP subdomain slug-shadow guard
description: Why assigning a managed <label>.lpstudio.ai host must check it doesn't shadow another tenant's wildcard slug.
---

Every tenant gets a free managed landing-page address stored in `tenants.microsite_domain` (default `<slug>-lp.lpstudio.ai`). Managed `*.lpstudio.ai` hosts skip Cloudflare provisioning (`cloudflare_hostname_id = NULL`); custom domains still provision + are plan-gated.

**Rule:** before writing a managed host `<label>.lpstudio.ai` into a tenant's `microsite_domain`, reject (or skip) if `<label>` equals ANOTHER tenant's `slug`. A label equal to the SAME tenant's own slug is fine.

**Why:** `findTenantByHost` matches an exact `microsite_domain` BEFORE falling back to the wildcard `<slug>.lpstudio.ai` resolution. So tenant A claiming `b.lpstudio.ai` (where `b` is tenant B's slug) would hijack tenant B's legacy wildcard host. The guard preserves the "old `<slug>.lpstudio.ai/lp/<page>` URLs keep working" invariant.

**How to apply:** the guard must exist at EVERY write path that can set a managed host — signup default assignment, the admin POST attach (managed branch), and the admin DELETE fallbacks that revert to the managed default — plus the journaled backfill migration. SQL form: `AND NOT EXISTS (SELECT 1 FROM tenants s WHERE s.id <> $self AND lower(s.slug) = $label)`.

**Plan-gating split:** the managed address is FREE for every tenant — no `requirePlanFeature` at the route level. Only attaching a CUSTOM (non-`lpstudio.ai`) domain is gated: POST returns 402 in the non-managed branch when the plan lacks `customDomain` (superadmin bypasses, fail closed). The custom-domain status state carries `customDomainAllowed` so the UI shows the upgrade prompt inline inside the "use your own domain" mode rather than locking the whole page.
