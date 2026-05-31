---
name: Running long Playwright/e2e in the agent sandbox
description: How to actually run a long-booting Playwright spec to completion from the agent environment
---

Long Playwright e2e runs cannot be completed with the normal bash tool or with
detached background processes in this agent sandbox.

**Why:**
- The bash tool caps at 120s/call, but the lp-studio Playwright `webServer`
  boots its own api-server on E2E_API_PORT (4319) + vite on E2E_PORT (4318),
  and that cold boot vs the Neon dev branch routinely takes 2–3 min (config
  timeout is 300s). The run produces no reporter output until tests start, so a
  bash call just times out mid-boot with an empty log.
- `setsid ... &` / `nohup ... &` do NOT survive: the platform reaps non-workflow
  child processes between tool calls — the detached node dies during webServer
  boot, leaving a 0-byte log.
- The running artifact workflows (api-server / web) bind system-assigned ports,
  NOT 4318/4319, AND the vite `/api` proxy is gated off when REPL_ID is defined,
  so Playwright (`reuseExistingServer` without CI) can't reuse them — it boots
  fresh servers regardless.

**How to apply:**
- Run the spec inside a temporary **workflow** (the only persistent execution
  context): `configureWorkflow({ name, command: "cd artifacts/lp-studio && CI=1
  npx playwright test <spec>", outputType: "console" })`, then poll
  `getWorkflowStatus({ name })` until `state === "finished"` and read `output`.
  `restartWorkflow` re-runs it after edits. `removeWorkflow` to clean up.
- Filter `[WebServer]` lines out of the output to see the Playwright summary.
- Two timed-out foreground runs left half-booted webServers that caused
  EADDRINUSE on 4319 for later runs — kill stray `playwright test` + free
  4318/4319 before launching, and never use `pkill -f "playwright test"` (it
  matches your own shell's command line → SIGTERM 143).
