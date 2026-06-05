---
name: Tenant-host OG fallback cascade
description: How OG/title metadata is resolved for tenant and Dandy hosts (ent/lp/partners.meetdandy.com) and why LP Studio must never leak.
---

On tenant hosts (incl. Dandy ent/lp/partners.meetdandy.com), share-card/OG
metadata cascades: **per-page meta → tenants.default_og_title/description/image_url
→ derived page content → tenant name.** LP Studio / lpstudio.ai branding must
NEVER appear as a fallback on a tenant host. lpstudio.ai marketing metadata is a
separate path (homepage-og) and stays in PASSTHROUGH_HOSTS, so it never reaches
the tenant cascade.

**Why:** Hardcoded per-host title/OG branches (ent/partners) used to live in
index.html; they were replaced by the DB-driven tenant default so each tenant
controls its own card. The Dandy tenant's stored default once carried a stale
"- LP Studio" title suffix that leaked onto its own social previews.

**How to apply:**
- Bot/scraper paths: per-page `GET /api/lp/og-preview/:slug` uses resolvePageOG
  (the cascade). Host root (no slug) uses `GET /api/lp/og-host-preview`, which
  resolves the tenant by host and emits default_og_*. Both are LP_PUBLIC.
- The CF tenant-host-router worker routes bot UAs to og-host-preview AFTER the
  PASSTHROUGH check (so lpstudio.ai is never intercepted) and falls through to the
  tenant shell on a 404 (host maps to no tenant).
- Robots on these previews come from resolveRobotsContentForPage (inherit). An
  explicit tenant `settings.seo.allowIndexing/allowFollowing` OVERRIDES the
  protected-slug (isProtectedEnterpriseSlug) default — e.g. Dandy id=1 (ent/
  partners) is explicitly noindex,nofollow by its own SEO config; dandy-smb
  (lp.meetdandy.com) is index,follow. That is intentional, not a regression.
- OG image URLs may be stored root-relative (/api/storage/...); absolutise
  against the request host before emitting (scrapers don't run the SPA).
