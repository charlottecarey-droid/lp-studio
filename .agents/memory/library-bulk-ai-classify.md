---
name: Library bulk-AI classify must be tenant-scoped + resumable
description: Why the Media Library "Classify for AI" is client-driven batches over a tenant-scoped targets endpoint, not a global background loop.
---

Media Library bulk-AI operations (e.g. "Classify for AI" backfill) must be:
- **Tenant-scoped** via `libraryWritablePredicate(scope.ownedTenantIds)` — the SAME
  own+reciprocal-sibling scope every other library write uses (tag / bulk-tag / delete).
  The grid the user sees uses `libraryReadablePredicate(ownedTenantIds)`, so the
  classify set matches what they can already see and edit. Do NOT make it superadmin
  global, and do NOT narrow to bare `eq(tenantId)` (that would strand sibling rows the
  user can tag/delete in their own grid).
- **Client-driven in batches** (≤20/req) against two endpoints: a `classify-targets`
  GET returning untagged image ids, and a `classify-batch` POST that re-verifies
  ownership per id and returns per-id status. The batch endpoint must REPORT
  rate-limited ids (HTTP 429 from the AI proxy) as `rate-limited`, never count them as
  failed/done — the client backs off (~15s) and re-queues them.
- **Resumable**, not durable-jobbed. Convergence comes from re-running: targets only
  returns still-untagged rows, so a fresh click resumes. A client attempt-cap +
  treating genuine `error`/`skipped` as done prevents infinite loops; persistently
  rate-limited rows are picked up on the next run.

**Why:** the original route was superadmin-only + GLOBAL (all tenants), a
fire-and-forget `setImmediate` loop that died on app restart and ABANDONED
rate-limited images (counted them failed, moved on) — so it silently "stopped at ~20"
and left images untagged. Multiple app instances exist, so progress must be derived
from data (targets endpoint), never in-memory job state.

**How to apply:** any new "classify/retag/enrich all my library images" feature follows
this shape. Routes live in `artifacts/api-server/src/routes/storage.ts`; the driver is
`handleReclassify` in `artifacts/lp-studio/src/pages/content-library.tsx`. These are
normal tenant-auth routes — do NOT add them to the `LP_PUBLIC` allowlist in
`artifacts/api-server/src/routes/index.ts`.
