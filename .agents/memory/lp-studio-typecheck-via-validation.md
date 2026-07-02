---
name: lp-studio typecheck must run via validation skill
description: How to typecheck the lp-studio artifact without hitting the bash timeout / process-reaping traps.
---

`npx tsc --noEmit` (and `tsc -b`) on `artifacts/lp-studio` is pathologically slow
on a COLD cache — routinely >12 minutes — far past the 120s bash cap. (With warm
incremental caches a validation-run `pnpm --filter @workspace/lp-studio run typecheck`
completed in ~2 min — Jul 2026 — but never bet on the cache being warm from raw bash.) Backgrounding it with
`&` / `nohup setsid … &` does NOT help: detached shell children get reaped when
the foreground bash call returns, so the run silently never finishes (log stays
at "START tsc", process vanishes).

**How to apply:** typecheck lp-studio through the `validation` skill instead —
`setValidationCommand({name, command:"cd artifacts/lp-studio && npx tsc -b --incremental"})`
then `startValidationRun`. It runs in the managed environment with no 120s cap
and isn't reaped; it returns PASSED/FAILED + a log path. Clear the temp command
afterward with `clearValidationCommand`. (api-server, by contrast, typechecks
fine in <120s with a plain `npx tsc --noEmit`.)

**Why:** same root cause as the long-e2e-via-workflow note — the bash tool's
timeout + child reaping make any multi-minute command unrunnable from a raw
shell; a platform-managed runner (validation step or workflow) is the only
reliable path.
