---
name: lp-studio dev "Invalid hook call" spin
description: lp-studio dev app shell spins / crashes into RouteErrorBoundary while homepage renders fine — stale Vite dep cache, not a code bug
---

Symptom: lp-studio dev — the marketing homepage (`/`) renders fine, but the SaaS shell / lazy-loaded routes (`/?preview=app`, `/superadmin`, builder, etc.) spin forever or flash and die. Browser console shows repeated `Invalid hook call ... You might have more than one copy of React in the same app` crashing lazy routes into `RouteErrorBoundary` / `_ErrorBoundary`. The API server is healthy (all `/api/*` return 200) — it is purely a frontend dep-optimization problem.

**Why:** Vite's pre-bundled dependency cache (`node_modules/.vite/deps`) goes stale and serves a second copy of React to lazy chunks, violating the single-React invariant only on code-split routes (so the eagerly-bundled homepage survives).

**How to apply:** `rm -rf artifacts/lp-studio/node_modules/.vite node_modules/.vite` then restart the `artifacts/lp-studio: web` workflow. Verify via an app-shell screenshot (`/?preview=app`) rendering the sign-in screen with no hook-call errors. Same root cause as the earlier "create-page spin." First thing to try whenever a non-technical user reports "the app just spins" but the homepage loads.
