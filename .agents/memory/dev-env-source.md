---
name: Dev env source in this Repl
description: Where dev-workflow processes actually read env vars from in this monorepo.
---

Dev workflows in this Repl get their env from `.replit`'s `[userenv.shared]` block and from gitignored `.env` files (loaded via `dotenv` / `--env-file-if-exists`). They do **NOT** see Replit Secrets (Tools → Secrets) — those are scoped to the agent and to deployments, not to local workflow shells.

**Why:** Confirmed empirically May 2026 — `CSRF_SECRET` was set in Replit Secrets but api-server still failed with "CSRF_SECRET is required at startup" until the value was added to `.env`. The agent shell also had `$CSRF_SECRET` unset despite the Secret existing.

**How to apply:** Any dev-only secret (anything the api-server or other workflow needs at startup) must go in gitignored `.env` (project root) — not Replit Secrets. Use Replit Secrets only for prod-deployment values. If you're tempted to put a secret in `.replit`'s `[userenv]`, don't — it will be committed to git. `.env` is already in `.gitignore`.

**Prod-only sensitive credentials → use global Replit Secrets, NOT `[userenv.production]`.** `[userenv.production]` (and `[userenv.shared]`) are written as PLAINTEXT into the git-tracked `.replit` — a production-scoped env var leaks the value to source control just as a shared one does. Global Secrets reach deployments but NOT dev workflows, so a prod-only secret (e.g. `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) stored as a Secret keeps dev on its fallback path (Stripe broker) while still working in production — same isolation as a production-scoped env var, minus the plaintext leak. Confirmed: `STRIPE_ENABLED` is a Secret and is present in the prod deployment runtime, proving Secrets inject into deployments. Non-sensitive prod config (e.g. `PUBLIC_API_BASE_URL`) is fine as a plaintext `[userenv.production]` env var.
