---
name: Replit container detach pitfalls
description: How long-running subprocesses survive (or don't) across bash-tool timeouts in the Replit agent container.
---

# Replit container detach pitfalls

When a long-running command exceeds the 2-min bash-tool budget, only one detachment
pattern reliably keeps the job running to completion.

## What works
- **Foreground via the bash tool, with a pipe.** Pattern:
  `cd <dir> && stdbuf -oL -eL node --import tsx script.ts ... 2>&1 | tee /tmp/x.log | grep ...`
  When the tool times out at ~120s, the tool sends SIGKILL to the bash tool's process
  group, but the node child (re-parented to init via the pipe / tee teardown) keeps
  running and finishes. A subsequent tool call can `sleep 60-90s` and read `/tmp/x.log`
  to see the full output. We observed this surviving 130-160s of additional execution
  beyond the tool's death repeatedly.

## What does NOT work
- **`( setsid nohup script.sh >LOG 2>&1 </dev/null & ) &`** (classic double-fork
  daemonization). The grandchild reaches PPID=1 and starts running, but is killed by
  the container within ~60-120s with no log entry, no exit code, no dmesg trace.
- **`setsid nohup node ... &`** invoked inline. Same fate: process visible briefly,
  then gone, often after writing the first few lines of output.

**Why:** unclear. Likely a container-level reaper that kills processes not anchored to
an active workflow or active shell session. Treat any non-foreground long job as
unreliable in this environment.

## How to apply
- For multi-minute jobs in the bash tool, **chunk the work** so each chunk completes
  (or nearly completes) within ~110s of foreground execution. Accept that the tool
  will exit -1, then in the next tool call `sleep 30-90s` and read the log.
- If the job is naturally idempotent (re-running a chunk is safe), the
  "tool-timeout + orphan-finishes-anyway" pattern is the most reliable shape.
- Do NOT rely on `setsid`/`nohup` to keep a job alive across multiple tool turns in
  this container. If you need a true long-running service, register it as a
  workflow instead.
