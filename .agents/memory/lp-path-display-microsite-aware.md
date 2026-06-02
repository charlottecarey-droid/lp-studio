---
name: Page-path display must be microsite-aware
description: Every user-facing "/lp/<slug>" label and live-URL link must respect micrositeDomain; callsites are scattered with no shared helper.
---

Tenant page-path displays are NOT uniformly correct — many UI surfaces independently hardcode `/lp/<slug>`.

**Why:** Microsite tenants (e.g. Dandy, `microsite_domain` set) serve pages at ROOT `/<slug>`, so `/lp/` is wrong for them. There is no shared formatter, so each list/label/link reimplements the path and several drifted to a hardcoded `/lp/`. A user complaint of "every page says /lp/" means several scattered callsites, not one.

**How to apply:**
- Display labels: `micrositeDomain ? \`/${slug}\` : \`/lp/${slug}\``.
- Clickable LIVE urls: `getLpPageUrl(slug, micrositeDomain, tenantHost)` — never `window.location.origin/lp/<slug>` (that's the ADMIN host → 404 for tenants).
- Source: `const { domainContext, user } = useAuth(); micrositeDomain = domainContext?.micrositeDomain ?? null; tenantHost = user?.tenantHost ?? null;` (matches all-tests.tsx / page-row.tsx).
- Each React component needs its OWN hook call — `micrositeDomain` is component-scoped; nested list components (e.g. leads LeadsContent) are easy to miss.
- Intentionally left alone: internal A/B variant preview URLs (variants-tab, BlockTestEditor) and one-pager web links — different surface, work on the app host.
