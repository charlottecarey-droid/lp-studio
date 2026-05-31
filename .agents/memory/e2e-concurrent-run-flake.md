---
name: e2e concurrent-run flake
description: Why the lp-studio e2e suite flakes (browser-closed, dist clobber) when run alongside the dev workflows, and how to get a clean run.
---

# lp-studio e2e suite: environmental flakes under concurrency

The Playwright e2e suite (`artifacts/lp-studio`, `workers:1`, `retries:1`) is
resource-sensitive. When it runs concurrently with the always-on dev workflows
(`artifacts/api-server`, `artifacts/lp-studio: web`, `mockup-sandbox`) plus
leftover Chromium from earlier manual runs, two distinct environmental failures
appear — neither is a code defect:

1. **`browserContext.newPage` / `page.evaluate`: "Target page, context or
   browser has been closed"** (often with a 90s timeout). Chromium can't spawn
   threads under memory/process pressure (`pthread_create: Resource temporarily
   unavailable`, dbus errors). Clusters on the heaviest specs
   (e.g. `sales-console-no-dandy-leak`, which re-renders in a tight loop).
   `retries:1` does NOT always rescue it because the browser stays dead while
   pressure persists. playwright.config.ts already documents this as env flake.

2. **api-server dev workflow dies with `ERR_MODULE_NOT_FOUND
   dist/instrument.mjs`.** The e2e webServer config can't reuse the dev
   api-server (dev runs on the artifact PORT, e2e expects 4319) so it spawns its
   OWN api-server that rebuilds into the SAME `artifacts/api-server/dist/`.
   A build started while the dev server is (re)starting clobbers `dist/`,
   leaving the dev `start` step unable to find its freshly-deleted files.

**How to get a clean run:** ensure the dev api-server is already up and idle
(not mid-build), kill orphan Chromium (`pkill -f headless_shell`), then run the
suite — ideally in isolation. A clean run passes 108/108. The authoritative
result is `artifacts/lp-studio/test-results/.last-run.json`
(`{"status":"passed","failedTests":[]}`); the refresh_all_logs snapshot files
(`/tmp/logs/e2e_*.log`) are stale and cap mid-stream — don't trust them for
pass/fail.

**Why:** the failures track system load, not code. Treat browser-closed /
resource-exhaustion failures as env flakes; only a repeatable assertion failure
in isolation is a real bug.
