---
name: E2E royal-tenant teardown clears tenant-FK children generically
description: Why lp-studio e2e cascades into whole-suite FK failures and how the royal-tenant teardown auto-discovers tenant-referencing tables instead of a hand-maintained list
---

The lp-studio Playwright e2e suite runs against the **shared prod Neon DB** (the
webServer env block only overrides PORT/HOST/Twilio/Turnstile — DATABASE_URL /
NEON_DATABASE_URL are inherited from the parent process), with `workers: 1`,
`fullyParallel: false`.

**Rule:** any teardown that does `DELETE FROM tenants` (both `cleanupRoyalTenant`
and the shared `purgeStaleRoyalTenants` beforeAll in
`tests/setup/royal-tenant.ts`) MUST first delete every tenant-scoped row whose
`tenant_id` FK on `tenants` is `ON DELETE NO ACTION`. Many tables CASCADE on
tenant_id and are fine, but a sizable set are NO ACTION (sales_*, lp_pages,
lp_library_items, lp_brand_settings, lp_forms, lp_integrations, …).

**Why:** If a leftover NO-ACTION child row survives a crashed spec,
`DELETE FROM tenants` raises 23503. Because `purgeStaleRoyalTenants` deletes ALL
`royal-test-%` tenants in beforeAll, ONE orphan turns into a whole-suite cascade:
every later spec's beforeAll throws the same FK error, and the DB stays poisoned
across runs until a teardown finally clears it.

**The fix (current design):** teardown no longer hand-maintains the table list.
`deleteTenantReferencingRows(client, tenantId)` DISCOVERS every single-column FK
referencing `tenants` from `pg_constraint` at runtime (cached), then deletes per
tenant inside a transaction using SAVEPOINTs + a retry loop: a table blocked by
an intra-table NO-ACTION FK from another tenant-scoped table (e.g.
`sales_email_campaigns.template_id -> sales_email_templates`) is retried until
its blocker is gone; if a full pass makes zero progress it throws a descriptive
error. Both `cleanupRoyalTenant` and `purgeStaleRoyalTenants` call it, so a newly
added tenant-FK table is covered automatically with NO manual edit.

**How to apply:** when adding a new tenant-scoped table, you do NOT need to touch
royal-tenant.ts — discovery covers it. The ONE remaining assumption (documented
in the big INVARIANT comment in that file): every FK from a NON-tenant-scoped
table into a tenant-scoped table must be ON DELETE CASCADE or SET NULL (verified
once via a catalog audit — query was empty). If someone adds a NO-ACTION FK from
a non-tenant-scoped child, discovery can't reach it and the retry loop throws
loudly rather than silently leaving an orphan; fix by making that FK CASCADE/SET
NULL or deleting its rows explicitly. `app_sessions` has no tenant FK (keyed by
sid) so it's still cleared explicitly by sid / email pattern.
