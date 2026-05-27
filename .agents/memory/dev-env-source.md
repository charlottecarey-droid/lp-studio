---
name: Dev env source in this Repl
description: Where dev-workflow processes actually read env vars from in this monorepo.
---

Dev workflows in this Repl get their env from `.replit`'s `[userenv.shared]` block and from gitignored `.env` files (loaded via `dotenv` / `--env-file-if-exists`). They do **NOT** see Replit Secrets (Tools → Secrets) — those are scoped to the agent and to deployments, not to local workflow shells.

**Why:** Confirmed empirically May 2026 — `CSRF_SECRET` was set in Replit Secrets but api-server still failed with "CSRF_SECRET is required at startup" until the value was added to `.env`. The agent shell also had `$CSRF_SECRET` unset despite the Secret existing.

**How to apply:** Any dev-only secret (anything the api-server or other workflow needs at startup) must go in gitignored `.env` (project root) — not Replit Secrets. Use Replit Secrets only for prod-deployment values. If you're tempted to put a secret in `.replit`'s `[userenv]`, don't — it will be committed to git. `.env` is already in `.gitignore`.
