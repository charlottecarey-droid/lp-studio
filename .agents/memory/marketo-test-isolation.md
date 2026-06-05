---
name: Marketo service test isolation
description: Why marketo-service HTTP-layer tests need a separate file + per-run-unique sales ids on the shared Neon DB
---

Two gotchas when testing `artifacts/api-server/src/lib/marketo-service.ts` against the real (shared Neon) DB:

1. **FAKE_MODE is a module-load-time const.** `const FAKE_MODE = process.env.MARKETO_FAKE_MODE === "1"` is captured once at import. A test that needs the REAL request/fetch wiring (token acquisition, nextPageToken pagination, 401-refresh-retry, non-2xx/`success:false` error paths) must live in its OWN test file with FAKE_MODE OFF and intercept `global.fetch`, NOT in the FAKE_MODE sibling that stubs the private `getLeadsByListPage`. Mock fetch by URL: `/oauth/token` → `{access_token,expires_in}`; `/v1/list/{id}/leads.json` → `{success,result,moreResult,nextPageToken}`. Restore `global.fetch` in afterAll.

**Why:** you can't toggle FAKE_MODE per-test within one file; the two modes are mutually exclusive per module instance.

2. **Several sales columns are GLOBALLY unique, not tenant-scoped:** `sales_accounts.salesforce_id`, `sales_contacts.salesforce_id`, and `sales_contacts.marketo_lead_id` all carry `.unique()`. Import fixtures across DIFFERENT test files (run concurrently by `vitest run` on the same Neon DB) collide if they hardcode the same ids (e.g. lead ids 1111/2222/3333 or "SFA-1"/"SFC-1"). Derive every written id from the unique per-run `tenantId` (e.g. `tenantId*1000+11`, `SFC-http-${tenantId}`).

**How to apply:** any new sales/marketo integration test that writes sales_accounts/sales_contacts rows must use per-run-unique salesforce_id + marketo_lead_id, or it intermittently fails only when scheduled alongside a sibling that uses the same literals. Symptom: 23505 duplicate-key, OR a silent miss (match query returns nothing / onConflictDoNothing no-ops) so counts come out wrong (e.g. updated=0).
