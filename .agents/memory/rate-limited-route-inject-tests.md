---
name: Rate-limited route tests via inject()
description: How to keep express-rate-limit from throttling in-process inject() route tests
---
Route tests that drive a rate-limited express route through the in-process `inject()` helper
share ONE undefined rate-limit key, because `inject()` sets no socket remoteAddress
(`req.ip` is undefined). Once a single test file makes more than the limiter's `max`
requests within the window, the surplus requests get a 429 and the test fails.

**Why:** the limiter's default keyGenerator reads `req.ip`; with no IP every request buckets
together. `generate-microsite` limits 5/min; adding a 6th POST in one file tripped it.

**How to apply:** in the test app's `beforeAll`, `app.set("trust proxy", 1)` and give each
`inject()` call a unique `x-forwarded-for` header (a small incrementing-IP helper). Each
request then gets its own limiter bucket while the real limiter stays in the chain.
Use `1` (not `true`) for trust proxy to avoid the ERR_ERL_PERMISSIVE_TRUST_PROXY warning.
