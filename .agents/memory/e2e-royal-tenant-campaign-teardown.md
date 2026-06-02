---
name: E2E royal-tenant campaign teardown + native-select locators
description: lp-studio Playwright specs that drive the campaign wizard — sales_* FK teardown order and how to target native <select> dropdowns.
---

Two gotchas when adding a Playwright spec that drives the Quick Campaign wizard
in lp-studio as a Royal-style tenant.

## sales_* FK blocks royal-tenant teardown
The email/draft path (ensureDraft → POST /sales/campaigns, preview, and the
"Saved template" compose path) inserts into `sales_email_campaigns` and
`sales_email_templates`, whose `tenant_id` FK references `tenants`.
`cleanupRoyalTenant` / `purgeStaleRoyalTenants` do NOT know about these tables,
so a campaign run leaves orphan rows that make `DELETE FROM tenants` raise
23503 and poison every later run.

**How to apply:** in your own afterEach/afterAll clear, in order,
`sales_email_campaigns`, `sales_email_templates`, `sales_hotlinks`,
`sales_contacts`, `sales_accounts` by tenant_id BEFORE calling
cleanupRoyalTenant. In beforeAll, before purgeStaleRoyalTenants, sweep those
same sales_* tables for every `tenants.slug LIKE 'royal-test-%'` so a crashed
prior run is self-healed.

## Native <select> locators
`dialog.locator("select").filter({ has: getByRole("option", {name}) })` does
NOT reliably match a collapsed native `<select>` (options aren't actionable
nodes) — it times out. Use `filter({ hasText: <unique option text> })`: a
select's text content concatenates all option labels, so a unique page/option
title disambiguates it from sibling selects. Then `selectOption({ label })`.

**Why:** the campaign wizard step 1 has two native selects (landing page +
account filter); the page title only appears in the landing-page select's text.
