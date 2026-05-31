---
name: E2E networkidle vs persistent SSE
description: Why Playwright waitUntil:"networkidle" hangs on LP Studio SaaS-shell routes, and the fix.
---

LP Studio's authenticated SaaS shell opens a long-lived SSE connection (cross-instance
notification broker). On any shell route, Playwright `page.goto(url, { waitUntil: "networkidle" })`
therefore NEVER settles and dies on the 90s test timeout — the page itself loads fine.

**Why:** networkidle waits for ~500ms of zero in-flight network; a persistent SSE/EventSource
stream keeps a request open forever, so the condition is unreachable.

**How to apply:** For shell routes (e.g. `/?preview=app`, `/sales`, `/sales/*`, billing),
use `waitUntil: "domcontentloaded"` and rely on explicit element/URL assertions
(`expect(getByRole(...)).toBeVisible()`, which auto-wait) for readiness. Never use
networkidle on a shell route. A 90s `page.goto` timeout with no other error is almost
always this, not a redirect loop or env flake — fix the wait strategy, don't assume flake.
