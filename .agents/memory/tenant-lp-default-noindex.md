---
name: Tenant LP default-noindex policy
description: How tenant landing pages are kept out of search by default, the Dandy exception, and the two emission surfaces (meta + header) across prerender and live paths.
---

# Tenant landing pages are noindex by default

Every tenant landing page is `noindex` by **default**. The ONLY exception is the
Dandy tenant, gated server-side by **slug** via `isProtectedEnterpriseSlug`
(`@workspace/plan-config`, `PROTECTED_ENTERPRISE_SLUGS = ["dandy","dandy-smb"]`)
— never by brand name. Per-page opt-in is a single `lp_pages.allow_indexing = true`
override that always wins (resolved in `resolveRobotsMeta`).

**Why:** tenant pages publish on a shared apex domain; impersonating demos (real
brand logos/screenshots) look exactly like phishing to Safe Browsing. Default
noindex + a "Sent by [Tenant] for [Account]" provenance line keep them out of the
index and signal legitimate personalized B2B outreach.

## The two pure helpers (lib/lp-template-engine/src/robots.ts)
- `resolveTenantRobotsDefaults({isExcludedFromDefaultNoindex, seoAllowIndexing, seoAllowFollowing})`
  — excluded (Dandy) honors stored `tenants.settings.seo.*` read as `!== false`;
  everyone else gets `tenantAllowIndexing=false` (following stays stored).
- `resolveRobotsMeta` + `robotsMetaContent` — page override beats tenant default;
  returns null when fully allowed (NO redundant `index,follow` tag/header).

## Fail CLOSED
All server resolution fails **closed to "noindex"** on tenant-lookup error
(deviation from #494's fail-open). An anti-phishing control must never leak an
indexable page during a transient DB hiccup. An explicitly opted-in page
(`allow_indexing=true`) still stays indexable because the page override beats the
tenant default — only inherit pages go noindex during an outage.

## Two emission surfaces, kept in lockstep — robots `<meta>` AND `X-Robots-Tag`
- **Shared resolver:** `artifacts/api-server/src/lib/resolveRobots.ts`
  `resolveRobotsContentForPage(page)` — used by live SPA config, og-preview,
  and the debug `/lp/rendered/:slug` origin route.
- **Prerender (R2):** `triggerPublishedRender.ts` computes the directive and
  passes it to `uploadPublishedHtmlToR2(host, slug, html, {robots})`, which stores
  it as R2 object metadata key **`x-robots`** (omitted when fully allowed).
- **CF workers:** BOTH `cloudflare/tenant-host-router/worker.js` AND
  `cloudflare/og-bot-router/worker.js` read `obj.customMetadata["x-robots"]` in
  `fromR2` and emit it as the `X-Robots-Tag` response header. Any new worker that
  serves R2 HTML must do the same or the header silently drops.

**How to apply:** changing the robots policy means touching the pure helper AND
keeping all server callsites on the shared resolver AND both CF workers in sync.
The `<meta>` tag alone is insufficient — crawlers that only HEAD need the header.
