---
name: CF Worker Routes — single source of truth
description: Worker Routes for tenant-host-router are API-managed; never re-add `routes = [...]` to wrangler.toml.
---

Worker Routes attached to the `tenant-host-router` CF script must NOT be declared in `cloudflare/tenant-host-router/wrangler.toml`. They are managed exclusively via the Cloudflare API:

- Per-tenant routes are created by `provisionCustomDomain()` in `artifacts/api-server/src/lib/cloudflare.ts` when a customer adds a custom domain (atomic with the Custom Hostname; rolls back on failure).
- Platform routes (`*.lpstudio.ai/*`, the Dandy hostnames, etc.) are reconciled by `artifacts/api-server/scripts/sync-worker-routes.ts`. Idempotent; safe to re-run.

**Why:** when `routes = [...]` is present in `wrangler.toml`, `wrangler deploy` reconciles routes against that list and silently DELETES every route attached to the script that isn't declared. Once wiped out an API-provisioned customer route (lp.frambam.com → HTTP 525, May 2026) because we'd added a partial `routes = [...]` for an unrelated change. HTTP 525 = "CF → origin SSL handshake failed", which here means "no Worker Route, so CF tried to proxy the customer hostname straight to the Replit edge, which has no cert for it."

**How to apply:**
- Never add `routes = [...]` back to that wrangler.toml. Comment block at the top of the file already says this; trust it.
- After any `wrangler deploy` of the script, run `pnpm --filter @workspace/api-server exec tsx scripts/sync-worker-routes.ts` as belt-and-suspenders.
- If a customer reports HTTPS failing on a domain that previously worked, check `curl -sI https://<host>/` — a 525 with `server: cloudflare` strongly implies the Worker Route was deleted. Run the sync script.
