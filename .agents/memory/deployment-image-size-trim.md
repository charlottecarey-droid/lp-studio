---
name: Deployment image 8 GiB trim
description: How to fix "image size is over the limit of 8 GiB" publish failures on this repo.
---

Autoscale/Reserved-VM deployments cap the packaged image at 8 GiB (nix layer + repl layer). Symptom: build SUCCEEDS (vite build, marketing prerender, R2 upload all complete) then the deploy fails at final packaging with `error: image size is over the limit of 8 GiB`; the live site stays up on the prior successful build.

**Why it's tricky here:** production RUNTIME launches Chromium via the `playwright` PROD dep (api-server video.ts, lib/prerenderLpPage.ts, brand-import/extractors/logos.ts), so `.cache/ms-playwright` browsers must NOT be stripped. `node_modules` is needed too.

**Constraint:** direct edits to `.replit` are BLOCKED (incl. `[deployment.postBuild]`). `.replitignore` is risky for build-time dirs because excluded paths may also be absent during the build.

**How to apply:** append `&& rm -rf …` cleanup to each artifact's `services.production.build` via `verifyAndReplaceArtifactToml`. This runs in the ephemeral deployment-builder copy AFTER that artifact's build (order-safe; never touches the real workspace). Safe targets, with where to put them so build order can't break:
- `.pnpm-store` (~1.1G), `.config/chromium` (~0.4G; dev profile, NOT playwright), `.backups` — none needed by any build or at runtime → put in api-server build cleanup.
- `attached_assets` (~0.8G) — vite bundles imported assets into dist at build time; zero runtime fetch refs in either app src → remove ONLY at the END of lp-studio's build (it's the consumer).
Do NOT strip `.cache` (runtime+build browser) or `node_modules`. After editing, user must re-Publish.
