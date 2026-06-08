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

The same `dist/` wipe is **self-inflicted** if you run `node ./build.mjs` (or
`pnpm run build`) manually while the api-server workflow is (re)starting:
`build.mjs` does `rm(distDir, {recursive,force})` first, so your manual build
deletes the files the workflow's `start` step is about to `--import`. Symptom is
the identical `ERR_MODULE_NOT_FOUND dist/instrument.mjs`. Don't run manual builds
to "verify" while the workflow is booting — just restart the workflow once and
wait; verify via `curl localhost:8080/api/healthz` (200), not by rebuilding.

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

**Compounding degradation from back-to-back mark_task_complete runs.** Each
`mark_task_complete` starts a fresh validation run whose e2e command keeps
RUNNING (~10min); the MarkTaskCompleteWorkflow can return with the e2e command
still `status:"RUNNING"` while the playwright process keeps hammering the shared
Neon DB in the background. Calling mark_task_complete repeatedly stacks multiple
live e2e runs on the same DB, and the failure count escalates run-over-run with
identical code (seen: 0 → 7 → 65). The signature shifts from per-test timeouts
to broad backend `failed with status code 500` / `request aborted` across
unrelated specs (pending_review gating, grid-piece perms, marketo, workspace-
finder, approval-workflow) plus many failed-then-passed-on-retry — i.e. the
backend itself is starved, not the code. **Before re-running, list runs via the
validation skill (`getValidationRuns`) and `stopValidationRun` every stale
`RUNNING` one** so only one e2e touches the DB. If the backend is already
degraded (500s in an otherwise-isolated run), don't keep retrying a shared env —
rely on the last clean full pass + green tc/img-test + code review, and complete
with an environment-blocked `skip_validation_reason`.
