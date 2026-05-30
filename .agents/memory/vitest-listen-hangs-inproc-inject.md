---
name: vitest app.listen hangs — use in-process injection
description: Why api-server route tests must not bind a TCP port; use the shared inject() helper instead.
---

In this environment the vitest worker pool (both `forks` and `threads`) never
fires the `app.listen(...)` callback, so any route test that binds a real port
and uses `fetch` hangs forever (plain `node` binds fine; it is vitest-specific).

**Rule:** api-server route/middleware tests must drive the express app
in-process via `inject(app, {method,url,headers,body})` from
`artifacts/api-server/src/test-utils/injectRequest.ts` — a fabricated
IncomingMessage/ServerResponse pair, no socket. It still runs the full
middleware chain (cookie-parser, body parsing, auth, handlers); only the network
layer is bypassed. Returns `{status, json, text}` (json = parsed body or
undefined).

**Why:** the listen-callback starvation is silent — the test just times out with
no error, easy to misread as a code bug.

**How to apply:** never reintroduce an `app.listen(0)` + `fetch` harness in
api-server tests. Carrying a session cookie? wrap inject with a tiny local
helper that sets `headers.cookie`. The helper file lives under `test-utils/` so
vitest (collects `src/**/*.test.ts` only) does not pick it up as a test.
