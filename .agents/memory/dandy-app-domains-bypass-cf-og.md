---
name: Dandy app domains bypass CF (OG cards)
description: Why ent.meetdandy.com / meetdandy-lp.com show LP Studio's share card instead of Dandy's, and why it's infra not code.
---

# Dandy app domains can't get per-host OG to scrapers

Dandy's **app/admin domains** — `ent.meetdandy.com` (tenant 1, Dandy ENT) and
`meetdandy-lp.com` (tenant 5, Dandy SMB) — are served **directly by Replit
static hosting** (`server: Google Frontend`, no `cf-ray`). They do NOT pass
through the Cloudflare `tenant-host-router` worker. The static deployment serves
one prerendered `index.html` with **LP Studio's** OG title/desc/image baked in,
identical for every host. There is no per-host server hook on that path
(`injectPageMeta` runs only in `triggerPublishedRender.ts` for published LP R2
prerenders; `build.mjs` doesn't bundle the SPA into the api-server).

**Consequence:** social scrapers (no JS) on those two domains always get the LP
Studio card. A browser-only inline `<script>` in `index.html` can fix the tab
title but NOT scrapers.

## What IS correct (don't re-touch)
- api-server `/api/lp/og-host-preview` returns Dandy's OG correctly (200) for
  ent/lp/partners when called with `X-Worker-Secret: WORKER_HOST_SECRET` +
  `X-Original-Host`. The app layer is fine.
- `findTenantByHost` resolves ent→Dandy, meetdandy-lp.com→Dandy SMB,
  lp/partners.meetdandy.com correctly (verified against prod Neon).
- repo `worker.js` HAS the host-OG tier (`fetchHostOgPreview`, Tier 3.25).

## The two real gaps (both INFRA, not app code)
1. **Direct-served app domains bypass CF.** `ent.meetdandy.com` /
   `meetdandy-lp.com` DNS point at Replit, not Cloudflare, so the worker never
   runs for them. Fix = route them through CF (Cloudflare-for-SaaS custom
   hostname + proxied DNS in the meetdandy zone, same as lp/partners). apex
   `meetdandy-lp.com` can't plain-CNAME → needs CNAME-flattening/ALIAS.
2. **Even CF-fronted Dandy hosts weren't serving host-OG to bots.**
   `lp.meetdandy.com` / `partners.meetdandy.com` / `*-lp.lpstudio.ai` returned
   `x-lp-source: r2-tenant-shell` `<title>Landing Page Studio</title>` to a bot
   UA → the **deployed** worker is stale or missing `WORKER_HOST_SECRET` (so
   `fetchHostOgPreview` 404s → falls to tenant-shell). Fix = `wrangler deploy`
   the current worker + set its secret, then run `sync-worker-routes.ts`.

## Code lever (small, inert until DNS proxied)
`sync-worker-routes.ts` PLATFORM_HOSTS listed `meetdandy-lp.com` but omitted
`ent.meetdandy.com`; added it for route parity. A route on a non-CF host is inert.

**Why:** keeps the worker-route reconciliation ready for when ent's DNS is
pointed at Cloudflare. Does nothing on its own.
