---
name: Marketing multi-page SEO served from R2 edge
description: Why per-route marketing HTML must be served by the CF worker from R2, not the Replit static origin
---

The lpstudio.ai / www marketing site is multi-page (/, /for-marketing, /for-sales,
/features, /pricing, /compare, /privacy, /terms, /docs/*, /blog/*). prerender-marketing.mjs
correctly writes one `dist/public/<route>/index.html` per route, each with its own
title/description/canonical.

**Rule:** the per-route marketing HTML MUST be served at the edge (CF tenant-host-router
worker, Tier 0.5) from R2 key `_studio-marketing/<relpath>`, uploaded by
upload-assets-to-r2.mjs. The worker maps request path → key (`/`→`_studio-marketing/index.html`,
`/x`→`_studio-marketing/x/index.html`) and falls through to Tier 3 passthrough on any miss.

**Why:** the Replit static origin's SPA rewrite is `/* → root index.html` — it ignores the
per-route subdirectory files, so EVERY marketing route (apex passthrough) returned the
homepage HTML (identical title/canonical) to browsers AND crawlers. Same platform behavior
already worked around for /assets and tenant-shell. Origin/api-server can't fix it: apex
passthrough never reaches Express routes, and the static serving has no clean-URL/directory-index config.

**How to apply:**
- Gate Tier 0.5 to MARKETING_HOSTS = {lpstudio.ai, www.lpstudio.ai} only — NOT app.lpstudio.ai
  (SaaS app must still boot the SPA via passthrough).
- Keep the `pathNeedsOriginInsteadOfShell` guard so /api, /assets, /.well-known, robots.txt,
  sitemap.xml, favicons keep their own tiers.
- Marketing HTML is overwritten every deploy (content changes) — always PUT, never HEAD-skip,
  unlike immutable hashed assets.
- TWO-STEP ROLLOUT, order-sensitive: publish lp-studio first (uploads `_studio-marketing/*`),
  THEN `cd cloudflare/tenant-host-router && npx wrangler deploy` (worker is NOT deployed by the
  app publish; postBuild only prunes the pnpm store). Either step alone leaves old behavior;
  fail-safe means no hard failure in between.
