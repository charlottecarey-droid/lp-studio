---
name: E2E royal-tenant teardown must clear NO-ACTION tenant-FK children
description: Why lp-studio e2e cascades into whole-suite FK failures and how the royal-tenant teardown must clean sales rows before deleting a tenant
---

The lp-studio Playwright e2e suite runs against the **shared prod Neon DB** (the
webServer env block only overrides PORT/HOST/Twilio/Turnstile — DATABASE_URL /
NEON_DATABASE_URL are inherited from the parent process), with `workers: 1`,
`fullyParallel: false`.

**Rule:** any teardown that does `DELETE FROM tenants` (both `cleanupRoyalTenant`
and the shared `purgeStaleRoyalTenants` beforeAll in
`tests/setup/royal-tenant.ts`) MUST first delete every tenant-scoped row whose
`tenant_id` FK on `tenants` is `ON DELETE NO ACTION`. Many tables CASCADE on
tenant_id and are fine, but a sizable set are NO ACTION — notably the sales
tables `sales_accounts`, `sales_contacts`, `sales_email_campaigns`,
`sales_email_templates`, `sales_audiences`, `sales_signals` (plus several `lp_*`
tables). Check live with: `SELECT confdeltype FROM pg_constraint` joined on
parent=`tenants` — `'c'`=cascade/`'n'`=setnull are safe, `'a'`/`'r'` block.

**Why:** Sales Console specs insert into `sales_accounts`/`sales_contacts`/
`sales_signals` under a `royal-test-%` tenant. If a leftover sales row survives,
`DELETE FROM tenants` raises 23503. Because `purgeStaleRoyalTenants` deletes ALL
`royal-test-%` tenants in beforeAll, ONE orphan turns into a whole-suite
cascade: every later spec's beforeAll throws the same FK error (saw ~14 specs
fail with `sales_accounts_tenant_id_fkey` while the actual culprit was a sales
spec). The DB stays poisoned across runs until a teardown finally clears it.

**How to apply:** delete sales rows in dependency-safe order (campaigns →
templates → accounts → contacts → signals → audiences): `sales_email_campaigns.
template_id` is NO ACTION so campaigns must precede templates; `campaigns.
account_id` is SET NULL so deleting accounts won't remove campaigns; deleting
`sales_accounts` CASCADEs to contacts/briefings/signals and (via contacts) to
sends/contact_briefings, the trailing explicit deletes mop up account-less rows.
Use the shared `deleteTenantSalesRows(client, tenantId)` helper from BOTH
teardown paths so they never drift. This is distinct from the generic
concurrent-run flake note — it's a deterministic, persistent shared-DB poison.
