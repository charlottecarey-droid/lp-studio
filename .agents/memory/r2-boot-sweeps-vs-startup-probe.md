---
name: R2 boot sweeps vs startup probe
description: Why eager on-boot R2 sweeps + under-tuned S3 clients fail the autoscale deploy promote step (zero-log symptom).
---

# R2 boot sweeps must stay off the cold-start critical path

LP Studio's api-server deploys to autoscale (cloud_run). The deploy BUILD can
fully succeed (layers pushed, "Creating Autoscale service") yet the deploy still
shows **failed** — that is a *promote / startup-probe* failure, not a build
failure. Tell them apart: read the build logs to the end (they pass) and check
for a ~5min gap between "Creating Autoscale service" and the failure time; then
confirm `fetchDeploymentLogs` shows **zero** production logs in the promote
window (container never reached "Server listening").

**Why zero logs:** pino uses a worker-thread transport that buffers. If the
event loop is starved during the probe window and the container is probe-killed,
buffered logs never flush — so a starvation/timeout failure looks like total
silence, not a stack trace.

**Root cause class:** the `app.listen` callback fired heavy R2 sweeps
(`runAssetHealthCheck` + `runAssetsGc`, which walk the whole bucket) immediately
on boot, and the per-module S3 clients used smithy's default ~50-socket pool
(prod log: `socket usage at capacity=50 and N additional requests are enqueued`).
That fan-out starved the loop so `/healthz` couldn't answer the startup probe in
time. Risk grows as the bucket/fleet grows — an earlier deploy squeaks by, then
one tips over.

**Rules:**
- Every R2 `S3Client` in api-server MUST be built via `buildR2S3Client()` in
  `lib/r2Storage.ts` (tuned `NodeHttpHandler` maxSockets 200 + keepAlive). New
  modules that do `new S3Client({...})` directly silently regress to the 50
  socket default — grep for `new S3Client` after any R2 work.
- Never run bucket-wide R2 sweeps synchronously in the `app.listen` callback.
  Defer the FIRST run with `setTimeout(...).unref()` (health 60s, GC 120s,
  staggered) so they don't compete with the startup probe; keep the steady-state
  `setInterval` cadence unchanged.
- `buildR2S3Client` MUST keep its socket-acquisition fail-fast: a big
  `maxSockets` + keepAlive but NO timeout means a saturated pool enqueues
  forever, so an on-demand request that needs R2 hangs until the CF edge 500s
  (symptom: 500 with NO origin completion log — e.g. POST
  `/api/sales/accounts/:id/generate-microsite`). The fix is smithy
  `NodeHttpHandler` `connectionTimeout` (bounds socket-acquire+connect; reused
  keep-alive sockets clear it so no false positives) + `requestTimeout` +
  `throwOnRequestTimeout`, plus `maxAttempts` so retries don't multiply load.
- Sweeps must not starve on-demand work even after boot: background sweeps
  (`assetHealthCheck`, `assetsGc`) build their client with
  `R2_SWEEP_MAX_SOCKETS` (small budget); on-demand/publish-path clients keep
  `R2_DEFAULT_MAX_SOCKETS`. `assetPresenceCheck` runs at PUBLISH time (critical
  path), so it stays on the default budget — it is NOT a sweep despite living
  next to them. Also bound per-page HEAD fan-out inside a sweep (worker pool),
  not an unbounded `Promise.all`.

**Why:** the startup probe hits `/healthz` (unconditional, registered before the
`/api/*` readiness gate) and must get 200 quickly on a cold start; anything that
starves the loop in that window fails the promote even though the code is fine.
