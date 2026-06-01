---
name: Sales one-pager "defaults won't save" = swallowed write error, not credentials
description: Why sales one-pager template-editor saves can silently fail and read as "not saving", and the two real mechanisms involved (global CSRF fetch interceptor + don't-swallow rule).
---

# Sales one-pager "defaults won't save"

The lp-studio sales one-pager editor saves template defaults via PUT to
`/sales/layout-defaults/:key`. When a save "appears to work but doesn't persist",
the cause is almost never serialization or a missing field.

## Two mechanisms to know

1. **Same-origin + global CSRF interceptor.** The client calls `API_BASE = "/api"`,
   which is SAME-ORIGIN to the app document — so cookies are sent by default and a
   manual `credentials:"include"` is redundant. The api-server enforces a
   double-submit CSRF token (header + `lp_csrf` cookie) on every cookie-authed
   mutation. The client injects it via a global `window.fetch` interceptor
   installed at app boot; a plain `fetch("/api/...")` is covered because it
   resolves to the patched `window.fetch` at call time. So raw `fetch` writes
   normally carry CSRF automatically.

   **Implication:** a bare curl/script PUT with only the session cookie returns
   403 "Invalid or missing CSRF token" — that's expected (curl bypasses the
   interceptor) and is NOT proof of a client bug. Don't chase `credentials` here.

2. **Never swallow write errors on a source-of-truth API.** The real trap was a
   save helper that wrote localStorage, fired the PUT inside `try { ... } catch {}`,
   and never checked `res.ok`. A failed PUT (expired session, CSRF refresh
   failure, third-party-cookie blocking in the preview iframe, 5xx) still resolved
   successfully, so the handler always showed "Template saved!" while nothing
   persisted. The failure was completely invisible.

**Why:** false-success is worse than a visible error — the user (and the next
agent) can't tell saving is broken, and stale rows accrue.

**How to apply:** for any write to an API that is the source of truth, check
`res.ok`, surface the server's `error` message, and let network errors propagate
so the UI shows a real failure instead of a fake success. Only then is "it says
saved but reloads empty" debuggable.

## Diagnosing "no save since field X shipped"

The dev api-server and prod share the same Neon DB. A stored row that has some
custom fields but is missing a newer field that the current save payload DOES
include is strong evidence that no successful save has happened since that field
shipped — narrow the window before assuming the whole path is broken.
