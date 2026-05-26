---
name: Tenant shell vs marketing-flash band-aids
description: Why the SaaS/tenant hosts need a separate Vite shell served by the CF worker, not just inline "hide and clear #root" scripts in index.html.
---

LP Studio's `dist/public/index.html` is the **prerendered marketing homepage** (built by `scripts/prerender-marketing.mjs` via Playwright). Replit's deployment edge serves it as the SPA fallback for any unmatched HTML path. That means tenant hosts (`partners.meetdandy.com`, `lp.meetdandy.com`, future `*.lpstudio.ai` tenants) see a marketing-homepage flash whenever they hit:

- a vanity link (resolved client-side in App.tsx, never prerendered)
- root `/` on a tenant host (APP_PATH_DENY skips R2 prerender lookup)
- an R2-miss / typo slug
- any SPA admin route on a tenant host

**Why:** the prerender step runs after `vite build` and overwrites the pristine Vite shell with a marketing snapshot. Tenant traffic falling through CF worker tier 4 → Replit edge → SPA fallback gets that snapshot.

**The fix that works:** copy Vite's built `index.html` to `dist/public/tenant-shell.html` BEFORE the marketing prerender writes over it, upload to R2 (`_studio-assets/tenant-shell.html`, short TTL — embeds hashed asset URLs that change every deploy), and have the CF tenant-host-router worker serve it on a new tier between passthrough and Replit rewrite. On R2 miss, fall through to Replit (worst case = pre-fix behavior).

**The fix that doesn't actually work:** inline boot scripts in `artifacts/lp-studio/index.html` that `document.documentElement.style.visibility = "hidden"` then clear `#root.innerHTML` and strip the `data-marketing-only="1"` CSS link. These run AFTER the marketing snapshot is parsed and applied — the flash is shortened, not eliminated. Don't try to "improve" those scripts to fix flash; the root cause is the wrong shell being served.

**How to apply:** any time the marketing/tenant shell split changes (e.g. new tenant-only metadata, new domain-specific scripts in index.html source), update both the prerender shell and verify the tenant-shell.html still has the right `<head>`. The shell IS Vite's built index.html — same source template — so domain-detect scripts in there work for both.

**Deploy ordering invariant:** assets must be in R2 (immutable) before the new tenant-shell.html overwrites the old one. `upload-assets-to-r2.mjs` enforces this — do not reorder.

**Won't help marketing hosts:** `lpstudio.ai`, `www.lpstudio.ai`, `app.lpstudio.ai` are in PASSTHROUGH_HOSTS — they short-circuit to origin before tier 3.5 ever runs. That's intentional; marketing hosts WANT the marketing prerender.
