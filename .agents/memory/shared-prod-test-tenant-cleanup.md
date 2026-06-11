---
name: Shared-prod integration-test tenant cleanup
description: How api-server integration tests must seed+tear-down tenants in the shared production Neon DB without orphaning/clogging.
---

Dev/test runs against the SHARED production Neon DB, so any tenant an integration test seeds
lingers in the real workspace list unless torn down correctly.

**Rule 1 — teardown must cascade via catalog discovery, never a hardcoded child-table list.**
A `DELETE FROM tenants` fails with 23503 if ANY tenant-FK child row remains. Hand-maintained
"delete these 3 child tables then tenants" teardown rots silently: a newly added tenant-scoped
table (ai_generation_log, lp_media, sales_signals, …) isn't in the list, the delete throws, and
a `.catch(()=>{})` swallows it → the tenant is orphaned forever. Use the shared helper
`artifacts/api-server/src/test-utils/tenantCleanup.ts` (`deleteTenantCascade`) which discovers
every single-column FK to `tenants` from `pg_constraint` at runtime and deletes in dependency
order with SAVEPOINT retries — the same approach proven in lp-studio `tests/setup/royal-tenant.ts`.

**Rule 2 — the beforeAll stale-purge needs MULTIPLE guards, not just a slug prefix.**
On a shared prod DB a bare `slug LIKE 'prefix%'` delete is a data-loss risk. `purgeStaleTestTenants`
requires slug prefix **+ exact seeded `tenants.name` + a min-age floor (default 30 min)**. The
name guard stops a real tenant that merely shares the prefix; the age floor stops race-deleting a
concurrent run's fresh fixture. Never swallow the cascade failure in the purge/afterAll — log it
(`console.warn` with tenant id) so future FK drift is visible instead of silently re-leaking.

**Rule 3 — hooks need a long explicit timeout.** Cascade delete does catalog discovery + many
per-table deletes against remote Neon; clearing even a handful of tenants exceeds vitest's 10s
default hook timeout. Pass `}, 120_000)` to both `beforeAll` (first run clears the backlog) and
`afterAll` (clears this run's tenants).

**Why:** the smoke suite `generate-microsite.smoke.integration.test.ts` orphaned ~40
`it-ms-smoke-*` tenants via exactly the swallowed-FK pattern in Rule 1.

**How to apply:** any api-server integration test that INSERTs a tenant must import from
`tenantCleanup.ts` for both the beforeAll stale-purge and the afterAll cascade. `app_sessions`
has no tenant FK (keyed by sid) → clean separately (`purgeExpiredTestSessionsBySid`, expired-only
to avoid the concurrency race). Other `it-*` families (it-blockcat/it-hotlink/it-marketo/
it-linkexport/it-cssub/it-camppreview/it-listorder/it-ms-refimg) are leftovers from OTHER
integration suites that don't yet use this helper — same treatment applies if asked to clean them.
