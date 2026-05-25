---
name: Prerender hash drift breaks published pages on lp-studio redeploy
description: Why every published landing page silently breaks after an lp-studio deploy until its R2 prerender is regenerated.
---

Published landing pages are prerendered into static HTML and stored in R2, then served at the tenant subdomain by a Cloudflare Worker. The prerendered HTML hard-codes the Vite asset URLs of the build it was rendered against (e.g. `/assets/index-BgkStuYI.js`, `/assets/index-KF5u_VbW.js`).

When lp-studio is redeployed, Vite emits a new hashed bundle (e.g. `/assets/index-Dn5XGrKd.js`) and the old hashed chunks stop existing on the origin. The SPA's history-fallback then matches the unknown asset path and returns `index.html` with `content-type: text/html`. The browser tries to execute HTML as an ES module, fails with a silent MIME error, React never mounts, and the visitor is left on the loading-spinner stub from `index.html` forever.

Symptoms a future agent will see:
- `curl -I https://<tenant>/assets/index-<oldhash>.js` returns 200 with `content-type: text/html` (not `application/javascript`).
- The prerendered HTML's `<script src=…>` hashes don't match what the current lp-studio origin serves at `/`.
- Page-config and brand-config APIs all return 200; only the bundle is broken.
- All cut-over tenants are affected after each deploy, not just one — partners.meetdandy.com is hidden from this because its DNS hasn't cut over yet, so visitors still hit lp-studio's live SPA directly.

**Why:** the prerender pipeline writes once and is never invalidated by lp-studio's deploy pipeline. There is no link between "lp-studio bundle hash changed" and "regenerate every published page in R2".

**How to apply:** if anyone reports "published page is broken / blank / stuck on spinner" after a recent deploy, check the JS asset content-type first. The fix lives in the publish pipeline, not in the viewer code. Possible directions: re-prerender every published `lp_pages` row on lp-studio deploy; have the origin return a deterministic JS shim for unknown hashed assets that triggers a one-shot reload; or have the Worker detect a stale-asset signal from the origin and bypass the R2 cache to serve the live SPA in degraded client-render mode.
