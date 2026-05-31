# Safe Browsing / phishing takedown runbook

How to respond when a tenant landing page (microsite) is flagged by Google
Safe Browsing, a browser ("Deceptive site ahead"), a registrar, or an abuse
report — usually for **brand impersonation** (a demo page using a real
company's name/logo on our shared apex domain).

## Background — why this happens

Tenant pages are published on a **shared apex domain**. A page that copies a
real brand (logos, product screenshots, "Sign in to Zoom") looks to an
automated classifier exactly like a phishing kit. Two controls reduce the
blast radius:

1. **Default noindex** (task #547) — every tenant page is `noindex` by default
   (robots `<meta>` **and** `X-Robots-Tag` header, in both the prerendered R2
   HTML and the live render path). The only exception is the Dandy tenant,
   gated server-side by **slug** (`isProtectedEnterpriseSlug`), never by brand
   name. Pages opt in per-page via `allow_indexing = true`. This keeps
   impersonating demos out of the search index in the first place.
2. **Provenance line** — published microsites render a brand-styled
   "Sent by [Tenant] for [Account]" (fallback "Sent by [Tenant]") footer so a
   human reviewer and Google's classifier can see the page is legitimate B2B
   outreach personalized for a named recipient, not anonymous impersonation.

Neither control removes an *already-flagged* page. That is what this runbook
is for.

## Response flow

### 1. Locate the flagged URL

- Get the exact URL from the report (Safe Browsing console, the red
  interstitial, the registrar/abuse email, or the customer).
- Identify the `(host, slug)` and the owning tenant. The host maps to a
  tenant via `findTenantByHost`; the slug is unique per tenant. You can also
  look the page up directly in the DB:

  ```sql
  -- by slug across tenants
  SELECT p.id, p.tenant_id, t.slug AS tenant_slug, t.name AS tenant_name,
         p.slug, p.title, p.status, p.allow_indexing
  FROM lp_pages p JOIN tenants t ON t.id = p.tenant_id
  WHERE p.slug = '<slug>';
  ```

### 2. Take it down (stop serving the impersonating content)

Choose based on severity. **Unpublish/delete** for clear impersonation;
**re-skin** only when the page is salvageable (e.g. an internal demo that
should have used a fictitious brand).

- **Unpublish or delete + purge cached HTML** — use the takedown script
  (`scripts/takedown-impersonating-demos.ts`). It unpublishes the matching
  page(s) (sets `status = 'draft'`) and purges the cached static HTML from
  **R2 (every active host) and the Replit OS debug cache**, so the edge stops
  serving the page within the CDN TTL (≤5 min s-maxage). See the script header
  for flags; always `--dry-run` first.
- **Re-skin to a fictitious brand** — edit the page in the builder to remove
  the real company's name/logo/screenshots, replace with a fictitious brand,
  then re-publish (which re-renders and overwrites the cached HTML).

A taken-down (unpublished) page also returns 404 from the prerendered/origin
paths because they re-check `status = 'published'` on every read — so even a
stale cache fails closed once the DB row flips.

### 3. Request review (clear the flag)

Taking the page down does **not** automatically clear an existing Safe
Browsing / interstitial flag.

- **Google Search Console** — if the property is verified, open *Security &
  Manual Actions → Security Issues*, confirm the issue is resolved, then
  *Request Review*.
- **Safe Browsing (no Search Console)** — submit the URL via the Safe
  Browsing "report incorrect phishing warning" form once the content is down.
- **Browser/registrar reports** — reply to the abuse contact noting the URL is
  taken down (and the page now returns 404 / is noindex), and request the
  flag be cleared.

Re-review can take hours to days. Until it clears, the interstitial may
persist even though the content is gone — that is expected.

### 4. Confirm

```bash
# Should NOT return 200 with the impersonating content; expect 404,
# and any served HTML must carry noindex.
curl -sI "https://<host>/<slug>" | grep -i -E 'x-robots-tag|x-lp-source|^HTTP'
```

## Recommended future follow-ups

These are out of scope for the immediate response but reduce recurrence:

- **Customer-link scanning** — periodically scan published page content (titles,
  block text, image alt/URLs) against a denylist of well-known brand names and
  flag/alert on matches before a third party does.
- **Separate user-content domain** — serve tenant microsites from a domain
  distinct from the marketing/app domain so a Safe Browsing flag on
  user-generated content can never poison the primary brand domain's
  reputation.
- **Provenance enforcement** — require a non-empty account/recipient on
  publish for sales-mode pages so every live microsite carries a real
  "Sent by … for …" attribution.
