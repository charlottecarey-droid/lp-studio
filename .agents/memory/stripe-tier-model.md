---
name: Stripe self-serve tier model
description: Rules for mapping Stripe subscriptions to LP Studio tiers and when Checkout vs Portal applies.
---

# Stripe ↔ tier mapping rules

The self-serve paid tiers are `starter`, `growth`, `scale` (each monthly +
annual). `free` is the no-Stripe floor; `enterprise` is sales-assisted. Lookup
keys follow `<tier>_<cadence>` and live in `stripePlanMapping.ts`; the seed
script (`scripts/src/seed-stripe-products.ts`) mirrors that convention locally
(it cannot import across the scripts rootDir) and a test asserts the mirror.

**Rule: cancellation/dunning downgrades to `free`, never `starter`.**
**Why:** `starter` became a PAID tier in the 5-tier rollout; parking a
cancelled/unpaid tenant on `starter` would give paid features for free. Applies
to `resolvePlanFromSubscription` (canceled/unpaid/incomplete_expired → `free`)
AND the `handleInvoicePaymentFailed` no-subId fallback.

**Rule: Checkout is only for tenants with NO active subscription.**
**Why:** Stripe Checkout `mode:"subscription"` ALWAYS creates a *new*
subscription. Any change (tier up/down OR cadence) for a tenant with an
active/trialing/past_due sub must go through the billing Portal, which modifies
the existing sub with proration. Routing a change through Checkout leaves the
old sub running → double-billing. The checkout-session guard returns 409 with
`use_portal_for_tier_change` / `use_portal_for_cadence_change` / `already_on_tier`.

**Rule: untrusted tier markers must fail closed to "no change", not `free`.**
**Why:** Prices carry `metadata.lpstudio_plan` so subs grandfathered onto an
archived/re-keyed price (lookup_key cleared) still resolve. But run an unknown
marker through `isSelfServePaidPlan` first — do NOT `normalizePlan(metaTier)`,
because that maps a typo to `free` and silently downgrades a paying tenant.
Unknown → `null` so the webhook leaves the plan untouched.

**Rule: changing a Stripe price means archive + recreate (prices are immutable).**
Set old price `active:false`, clear its `lookup_key`, stamp
`metadata.lpstudio_plan`, then create the new price with
`transfer_lookup_key:true`. Amounts are derived from `@workspace/plan-config`
(`priceMonthly*100` monthly; `priceAnnual*12*100` yearly) so Stripe never
drifts from the marketing/gate config.
