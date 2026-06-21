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

### RESOLVED for `meetdandy-lp.com` (2026-06-21) — point apex A record at CF, do NOT move nameservers
`meetdandy-lp.com` is a **Replit-managed domain** (Provider: Replit, name.com
registrar). Its Replit domain panel exposes **only DNS records, NO nameserver
field** — so the "Add site to Cloudflare + change nameservers" path is a DEAD END
(the full zone we created, id `9ecfcc9a293139079e1618ab056a4dc7`, sits PENDING
forever; harmless, can be deleted). Don't go down that road again for a
Replit-managed domain.
The Cloudflare-for-SaaS custom hostname was **already provisioned + active**
(SSL active, id `0f461f15-1d23-4ef9-9d3f-ca21c0680fb8`) on the lpstudio.ai zone,
and the worker route `meetdandy-lp.com/*` → `tenant-host-router` already existed
there. Only the apex DNS still pointed straight at Replit (`A @ 34.111.179.208`),
bypassing CF.
**The one fix:** in the Replit DNS panel, change `A @` from the Replit IP to
Cloudflare's SaaS-fronting anycast IPs `172.67.209.1` + `104.21.53.47` (same IPs
`fallback.lpstudio.ai` / `lp.meetdandy.com` resolve to). SaaS matches on
Host/SNI, so the active custom hostname catches it → worker injects Dandy OG.
Verify with `curl -A facebookexternalhit/1.1 --resolve meetdandy-lp.com:443:172.67.209.1 https://meetdandy-lp.com/`
→ Dandy title + `lpstudio.ai/dandy-og-card.png`. (Local resolver caches the old
Replit IP; use Google/Cloudflare DoH `?name=...&type=A` for a fresh authoritative
read.) Browser UA still shows shell `<title>Landing Page Studio</title>` — that's
CORRECT/expected (matches `lp.meetdandy.com`; SPA sets the real title client-side;
OG cards only matter to scrapers).
**Agent CF token caveat:** `CLOUDFLARE_API_TOKEN` can read zones + manage Workers
routes + custom hostnames, but has **NO DNS read/edit** (code 10000 auth error on
`/dns_records`) and **no zone-create**. So all DNS edits here are the user's job
in their panel; the agent can only verify.
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

## Can't deploy the worker from the agent env
The unlock (redeploy worker + set its `WORKER_HOST_SECRET`) is per
`cloudflare/tenant-host-router/README.md`: `npx wrangler login` (interactive
OAuth) → `wrangler secret put WORKER_HOST_SECRET` → `wrangler deploy`. In the
agent shell wrangler isn't installed and won't auto-install (npx canceled),
`CLOUDFLARE_ACCOUNT_ID` is absent, and `wrangler login` is interactive — so the
deploy requires a human with Cloudflare account access. `WORKER_HOST_SECRET`,
`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID` ARE present in the env; ACCOUNT_ID
is not.

