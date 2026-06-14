---
name: e2e runButton restart race
description: Why the lp-studio preview kept going blank on every checkpoint/restart, and the real fix.
---

# Preview-blank on every restart = e2e rebuilds the shared api-server dist

**Symptom:** lp-studio canvas/preview iframe goes blank after almost every checkpoint or agent-loop-end. api-server workflow is FAILED with `ERR_MODULE_NOT_FOUND dist/instrument.mjs`; `curl localhost:8080` = 000.

**Root cause:** The `.replit` `[workflows]` `runButton = "Project"` parallel workflow re-runs on every environment restart. Its task list included `workflow.run e2e`. The `e2e` workflow (`pnpm --filter @workspace/lp-studio exec playwright test`) has a Playwright `webServer` that runs the api-server's `pnpm run dev` = `build && migrate && start`, writing into the SHARED `artifacts/api-server/dist`. That build races the real `artifacts/api-server: API Server` workflow's build → clobbered dist → the real server's `--import ./dist/instrument.mjs` is missing → crash. NOT an app code defect.

**Why the obvious fixes don't work:**
- `configureWorkflow({name:"e2e", autoStart:false})` does NOT stop it. `autoStart` only controls start-immediately-after-configuration, NOT restart-on-boot. Boot/restart auto-run is driven by the `runButton` "Project" task list.
- `clearValidationCommand({name:"e2e"})` fails (`NOT_FOUND`): e2e was a plain workflow, never a registered validation. Only `img-test`/`tc-api`/`tc-lp` are validations (those are harmless — typechecks + vitest, they don't `pnpm run build` the api-server dist).

**The fix:** `removeWorkflow({name:"e2e"})`. It stops the running instance AND the system reconciles the `runButton` "Project" task list, removing the `workflow.run e2e` entry (verified: 0 `e2e` references left in `.replit`; runButton now only img-test/tc-api/tc-lp). Recreate e2e on demand with `configureWorkflow` when you actually need to run Playwright.

**How to apply:** If a heavy workflow auto-runs on every restart and races a service, the lever is the `runButton` parallel task list, not `autoStart`. Remove it via `removeWorkflow` (cascades to runButton). After removing, restart the affected service workflow once the racing build is gone, then verify health + screenshot.
