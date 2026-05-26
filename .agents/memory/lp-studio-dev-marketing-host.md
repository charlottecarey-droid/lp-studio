---
name: LP Studio dev mode marketing host
description: In dev, `/`, `/privacy`, `/terms` render the public marketing site, not the SaaS app. E2E tests that need the app shell at those paths must append `?preview=app`.
---

In `artifacts/lp-studio/src/App.tsx`, `isMarketingHost()` returns `true` in dev whenever the current path is in `MARKETING_PATHS = {"/", "/privacy", "/terms"}`. The whole app branches to the marketing bundle (no auth, no QueryClient, no AppLayout/sidebar) before AuthGate ever mounts.

**Why:** Production splits by host (`lpstudio.ai` → marketing, `app.lpstudio.ai` → SaaS), but in dev there's only one host, so the path is used as the discriminator.

**How to apply:** Any Playwright spec that needs the SaaS shell at `/` (sidebar, ModeToggle, Dashboard, AppLayout) must navigate to `/?preview=app`. Routes outside `MARKETING_PATHS` (e.g. `/sales`, `/pages`) already fall through to the SaaS app and don't need the override. After AppShell mounts, internal Wouter redirects back to `/` stay in the SaaS app — `isMarketingHost()` only runs once at mount.
