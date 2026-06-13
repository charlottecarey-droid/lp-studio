---
name: Prod deploy ships dev .env and clobbers injected Secrets
description: Why a present-but-empty prod secret crash-loops boot despite Replit Secrets being set — gitignored dev .env shipped to prod + dotenv override.
---

# Dev `.env` clobbers injected Replit Secrets in production

An Autoscale build ships the **entire workspace filesystem, including gitignored
files** — so the dev-only root `.env` IS present in production, even when a code
comment claims "this file does not exist in prod."

The env loader imported first by both the server boot and the migrate entry point
loaded that `.env` with `dotenv config({override: true})`. The dev `.env` holds
**blank placeholders** for prod-only secrets (e.g. an empty `TURNSTILE_SECRET_KEY`
so the dev preview skips the bot-check). With `override: true`, those blanks
**overwrite the real Replit Secrets** that Replit injects into the deployment's
env. A prod boot guard then reads an empty secret and the app crash-loops on
startup — health checks 500, promote fails, previous good build keeps serving.

**Diagnostic heuristic that pinned it:** a deployment log line like
`[dotenv] injecting env (N) from .env` whose N keys match the dev `.env` exactly.
Re-entering the Secret in the Secrets UI never helps — the empty `.env` value wins
on every boot.

**Why:** the override exists for dev/staging safety (force checked-in `.env` to beat
a stale cached injected `NEON_DATABASE_URL` so a fork can't point at the wrong DB).
That intent is dev-only; in production the injected env (Replit Secrets + `.replit`
`[userenv]`) is authoritative.

**How to apply:** gate the dev `.env` load on `process.env.NODE_ENV !== "production"`.
NODE_ENV is reliably `"production"` at loadEnv time in the deployment (the boot
guards already depend on it). Never let a checked-in/dev `.env` override real env
vars in prod. When a prod secret reads empty but viewEnvVars shows it present,
suspect a deployed dev `.env` + dotenv override BEFORE assuming the saved value is
blank. viewEnvVars `true` = key exists, not that the value is non-empty.
