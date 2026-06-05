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

**Chromium binary (libglib crash) — the big gotcha:**
- An ad-hoc `configureWorkflow`/bash playwright run fails with
  `chrome-headless-shell: error while loading shared libraries:
  libglib-2.0.so.0: cannot open shared object file`. This is NOT an env outage —
  playwright fell back to its bundled `chrome-headless-shell` (unwrapped, missing
  nix libs) because it found no system chromium.
- The registered `e2e` **validation** workflow does NOT hit this: the validation
  harness supplies a nix-wrapped chromium. The agent shell already has its path
  in env var `REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE` (e.g. a
  `playwright-browsers-*/chromium-*/chrome-linux/chrome` under /nix/store).
- lp-studio's playwright.config `detectChromium()` reads
  `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` (different name!) then `command -v
  chromium` (not on the agent PATH). So for any ad-hoc run, prefix the command:
  `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="$REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE"
  pnpm --filter @workspace/lp-studio exec playwright test <spec>` → real chromium
  launches, no libglib.
- This makes a fast single-spec verification possible: a clean isolated single
  spec finished in ~15s (webServers reuse-or-boot on 4318/4319), avoiding the
  full-suite concurrent-run flake (running alongside dev workflows mass-fails
  ~60 specs — pre-existing, not your change).
