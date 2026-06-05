---
name: Marketing-site superadmin config baking
description: How to make a marketing-site value (lpstudio.ai) superadmin-editable AND reach non-JS social scrapers
---

Pattern for making a value the marketing site renders (e.g. homepage OG share
card, featured templates) superadmin-editable while still reaching non-JS
social scrapers.

**The constraint:** the marketing site is prerendered at build time by
`scripts/prerender-marketing.mjs`, which runs `vite preview` (NO api-server) and
Playwright-snapshots the routes. Scrapers fetch that baked static HTML. So a
plain runtime `fetch('/api/...')` updates the live DOM but is invisible to
scrapers unless the prerender bakes it.

**The three coordinated pieces (must stay in sync):**
1. DB + public read endpoint (`GET /lp/homepage-og`, listed in `LP_PUBLIC`) +
   superadmin `GET/PUT /admin/lp/...` mirroring `featured-templates.ts`. Single-
   row config tables use `id` PK fixed to 1 + a `CHECK (id = 1)` + `ON CONFLICT (id)` upsert.
2. The marketing page (`home.tsx`) reads `window.__LP_<NAME>__` (prerender-
   injected) in a `useState` initializer, then `fetch`es the public endpoint in
   a `useEffect` to converge the live head; both fall back **field by field** to
   built-in defaults so nothing is ever blank.
3. `prerender-marketing.mjs` does a **best-effort, never-fatal** read and
   `context.addInitScript((v)=>{window.__LP_<NAME>__=v}, value)` BEFORE page
   scripts run.

**Why `pg` not `@workspace/db` in the prerender:** importing `@workspace/db`
eagerly constructs a `Pool` on module load. The prerender instead uses `pg`
directly (resolvable from lp-studio's own node_modules) with `NEON_DATABASE_URL`,
wrapped in try/catch → returns null on any failure (no URL, unreachable, table
absent). A failed read must NEVER fail the build; home.tsx's defaults cover it.

**Build-time DB caveat:** if `NEON_DATABASE_URL` isn't present in the deploy
build env, the prerender silently skips baking (edits still reach the live DOM
via runtime fetch, just not scrapers). Verify the baking line appears in build
logs if scraper-correctness matters.

**Reusable OG editing affordances** live in
`artifacts/lp-studio/src/components/og-share-card.tsx`: `OgCharCount`,
`OgDimensionWarning` (POSTs `/api/lp/og-image/resize`, returns a served URL),
`ShareCardPreview`, `useImageDimensions`, `OG_IMAGE_WIDTH/HEIGHT` (1200/630).
og:image must be absolute for scrapers — normalize relative `/api/storage/...`
to `https://lpstudio.ai/...` at the single render point.
