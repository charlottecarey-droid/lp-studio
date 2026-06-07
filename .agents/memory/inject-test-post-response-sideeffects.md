---
name: inject() tests vs post-response side-effects
description: Why in-process inject() route tests must POLL for side-effects that a handler performs after res.json/res.send.
---

# inject() tests must poll for after-response side-effects

Some api-server route handlers do best-effort work AFTER sending the response
(e.g. `PUT /lp/brand` sends `res.json(...)` and THEN runs the brand-logo media
tagging loop). The in-process `inject()` helper resolves as soon as the handler
calls `res.end()` — which is BEFORE that trailing async work has run.

**Rule:** an inject()-based test that asserts on a side-effect produced after the
response (DB writes in a fire-and-continue tail) must read with a small bounded
poll/retry (eventual consistency), not a single immediate read. A direct read
right after the response is timing-sensitive and flakes.

**Why:** `injectRequest` resolves on `res.end`; the handler keeps executing its
post-response tail on the event loop. An immediate query races that tail.

**How to apply:** add a `waitForX(predicate, timeoutMs)` helper that re-queries
until the predicate holds (or times out) and assert on its result. For a "did
NOT change / no-op" assertion add a short fixed settle delay instead, since
there is no positive condition to poll for.
