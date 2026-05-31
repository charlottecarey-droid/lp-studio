---
name: Snapshot provenance footer per-host
description: How the published-page snapshot keeps the "Sent by" footer correct per host
---

# Snapshot provenance footer per-host

The "Sent by [Tenant] for [Account]" footer is host-gated: it shows ONLY on a
microsite (accountId set) served on the tenant's shared subdomain
`<slug>.<wildcard base>`, hidden on the tenant's custom domain and for Dandy.

The LIVE path (`GET /lp/page/:slug`) decides per request from the visitor host.
The published SNAPSHOT is rendered to HTML ONCE and copied to one R2 object per
host the tenant owns — so a single baked footer state would be wrong for a
tenant that has BOTH a custom domain and the shared subdomain (this is the bug
the per-host strip below was introduced to fix).

**Rule: bake maximal, strip per host.**
- The prerender preview request (`/lp/preview/:slug?prerender=1`) gates
  provenance on the tenant's SHARED subdomain (`resolveSharedPublishedHost`), so
  an eligible microsite snapshot ALWAYS has the `[data-lp-provenance]` band.
  The editor preview (no `prerender=1`) still gates on the canonical host.
- `triggerPublishedRender.buildHtmlForHost(host)` then strips the band for any
  host that must not show it, via `applyProvenanceFooterForHost` in
  `lib/provenanceFooter.ts`.

**Why:** injecting the band per host would require reconstructing the SPA's
exact markup + brand styling; stripping is safe + idempotent, so we bake the
superset and remove where the live rule says hide.

**How to apply:** if you change the footer's DOM marker, gate logic, or add a
new host type, keep all three in sync — the SPA's `data-lp-provenance` marker,
`shouldShowProvenanceFooterOnHost` (mirror of live `resolveProvenance`), and the
prerender provenance host. OS debug snapshot is built for the primary host only
(footer state there is whatever the canonical host implies) — that's fine, it's
debug-only.
