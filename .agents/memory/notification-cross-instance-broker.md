---
name: Cross-instance notification broker (LISTEN/NOTIFY)
description: How in-app notification SSE pushes fan out across replicas, and the Neon pooler constraint that shapes it.
---

In-app notification SSE pushes are delivered both locally (in-process fan-out, fast
path) and across replicas via a Postgres LISTEN/NOTIFY broker
(`notificationBroker.ts`). `notificationStream.publishInAppNotification` runs
`deliverLocal` then `publishNotificationEvent`.

**Neon pooler constraint (the core reason for the design):**
- NOTIFY (publish) works fine through the pooled connection (`-pooler` / PgBouncer
  transaction mode) — it's a single statement that fires at commit. Publish uses the
  shared `pool` via `SELECT pg_notify($1,$2)`.
- LISTEN (subscribe) needs a *session* bound to one backend, which transaction-mode
  pooling does NOT support. The listener opens a dedicated **non-pooled** `pg.Client`
  on the Neon **direct** host, derived by stripping `-pooler` from the connection
  string (or `NOTIFY_DATABASE_URL` override). Confirmed working in dev: boot logs
  `[notificationBroker] listening for cross-instance notification pushes`.

**Loop avoidance:** every process stamps messages with a unique `INSTANCE_ID`. The
listener ignores its own echoes (origin instance already delivered locally), so the
broker only ever drives delivery on OTHER replicas. Never remove the INSTANCE_ID
skip or local clients get double-delivered.

**Why:** SSE registry is per-process; a notification created on replica B otherwise
never pushes to a tab on replica A until the client poll backstop fires.

**How to apply:** keep publish on the pooled pool, keep the listener on a non-pooled
connection. Don't `LISTEN` through `pool`. NOTIFY payload cap is 8000 bytes — oversize
messages skip the broker hop and rely on the client poll backstop (kept as the floor:
5-min cadence when SSE healthy in `use-notifications.ts`).
