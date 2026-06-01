---
name: Launch/send path DB reads must be inside the route try
description: Why an opaque bare "Failed to launch campaign" client error means an unhandled throw before the handler's try/catch.
---

Every DB read on the Sales Console campaign launch path (and similar send paths) must execute INSIDE the handler's `try/catch`, never before it.

**Why:** The frontend launch error handler does `await res.json().catch(() => ({}))` then `throw new Error(data.error ?? "Failed to launch campaign")`. So a *bare* "Failed to launch campaign" (no `: detail` suffix, no transient-busy message) is a tell that the backend returned a **non-JSON** body — i.e. an unhandled throw hit Express's default error handler. A 500/503 from the handler's own catch always carries an `error` field and would show detail instead.

The recurring cause: a DB read (e.g. `getSalesBrandContext`) plus sender-config validation sitting BEFORE the `try {`. Under brief connection-pool saturation (background sweeps share the small pool) that read throws "Connection terminated due to connection timeout" with nothing to catch it. An earlier hardening pass added `withDbRetry` + per-contact try/catch but only INSIDE the try, leaving the pre-try read exposed — so the bug "came back".

**How to apply:** When you see an opaque/bare client error on launch/send, look for DB calls above the route's `try {`. Move them inside and wrap transient-prone reads with `withDbRetry`. Early-return 4xx validations are safe to live inside the try (they return before throwing). `isTransientDbError`/`withDbRetry` live in `artifacts/api-server/src/lib/dbResilience.ts` (rejects real query bugs like 42703/23505, retries connect-timeout/ECONNRESET/53300/57P03).
