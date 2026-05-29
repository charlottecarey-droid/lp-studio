---
name: Stripe self-serve Checkout E2E (test clock)
description: How to write a runnable end-to-end "tenant upgrades and gates open" test for the Stripe billing flow without a hosted Checkout UI.
---

# Stripe self-serve Checkout E2E (test clock)

Hosted Stripe Checkout cannot be completed headlessly, so an automated
"free → paid, gates open immediately" test does NOT drive the Checkout page.
Instead, per Stripe's test-clock guidance:

1. Create a test clock (`stripe.testHelpers.testClocks.create`).
2. Create the tenant fixture on the `free` floor + an accepted admin member
   against the REAL `@workspace/db` pool (same pattern as
   `customDomainPoller.integration.test.ts`).
3. Create a customer **on the test clock** with `metadata.tenantId`, persist
   `stripe_customer_id`, attach `tok_visa` as the default PM, then create the
   `growth_monthly` subscription directly — this is identical to what a
   completed Checkout session yields.
4. Wrap the retrieved subscription in a `customer.subscription.created` event,
   sign it with `stripe.webhooks.generateTestHeaderString`, and drive it
   through the production `stripeWebhookHandler` (raw Buffer body + signature
   verification included). This is the real E2E path — not a stub.
5. Assert `tenants.plan='growth'` + snapshot columns, and that the live
   accessors (`getTenantPlan` / `getPlanFeatures`) now report growth
   (salesConsole false→true, pages cap null) — proof the gates opened.

**Why gated:** the suite is `describe.skipIf(!process.env.STRIPE_SECRET_KEY)`
so it is inert in stripeless dev/CI (Replit workflow shells get NO Stripe
connector creds — broker returns 401) and only runs when test-mode creds are
explicitly provided. `getStripe()` is env-first, so `STRIPE_SECRET_KEY` is all
it takes to point the same code at a test account.

**Watch out:** the `@workspace/db` pool points at the PROD (Neon) DB in this
repo, so a live run creates + tears down a real (temp) tenant fixture there —
keep cleanup defensive (unique slug, `catch`-guarded deletes, test-clock
delete cascades its customers/subs). Deleting the test clock is the only
Stripe-side cleanup needed.
