---
name: All plan='free' writes must close the trial window
description: Why every downgrade-to-free path must close an open trial, or effectivePlan re-lifts the tenant to Growth.
---

# Every `plan='free'` write must close an open trial window

Any path that drops a tenant to the Free floor MUST also close a still-open
`trial_expires_at` window (and stamp `has_trialed_before`). Use the shared
`CLOSE_TRIAL_ON_FREE_SQL` fragment exported from
`artifacts/api-server/src/lib/planFeatures.ts` — splice it into the `UPDATE
tenants SET plan=... ` next to the plan write. The three live paths are: the
in-app downgrade button (`billing.ts`), the Stripe cancel/unpaid subscription
webhook (`applyPlanFromSubscription`), and the dunning final-attempt downgrade
(both in `stripeWebhook.ts`).

**Why:** `effectivePlan()` resolves to `higherPlan(storedPlan, TRIAL_TIER)`
whenever `trial_expires_at > now()`. So writing `plan='free'` while a trial
window is still open does NOT downgrade the tenant — the next read lifts them
straight back to Growth, leaving the Sales Console + every gated feature
reachable until the trial date naturally passes. This is exactly how a
Stripe-cancelled or dunning-failed tenant kept the Sales Console for free. A
tenant who upgrades to a paid plan DURING their 14-day trial and is then
cancelled is the realistic trigger. Only `nextPlan === 'free'` needs the
fragment — paid resolutions keep the trial intact intentionally.

**How to apply:** when adding/auditing any tenant plan-write, if it can land on
`free`, include `CLOSE_TRIAL_ON_FREE_SQL`. Read-only trial guards (e.g.
`trialLifecycle.ts` SELECTs with `AND plan='free'`) don't count. Verify the
downgrade with the live accessors `getTenantPlan` / `getTenantPlanFeatures`
(they re-resolve via effectivePlan), not just the raw `tenants.plan` column.
