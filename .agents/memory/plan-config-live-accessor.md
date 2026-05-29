---
name: Plan config live accessor vs static map
description: When LP Studio plan features must come from the DB-backed accessor (and route through getTenantPlan) vs the static canonical map.
---

# Plan config: live accessor vs static map

LP Studio's plan tiers live in `@workspace/plan-config` (canonical defaults) and
are mirrored into a `plan_config` DB table (seeded by migration `0036`, kept in
lockstep by a drift test that parses the seed VALUES vs `PLAN_CONFIG`).

## Rule
Any **tenant-scoped or live** decision/output that exposes plan features or caps
must read the DB-backed accessor (`getPlanFeatures` / `getPlanFeaturesMap` /
`getPlanConfig` in `api-server/src/lib/planConfig.ts`), NOT the static
`PLAN_FEATURES` map. Static is only acceptable for the marketing Pricing page,
which is guarded by the drift test.

**Why:** SuperAdmin can edit caps/prices in the DB at runtime; anything still
reading the static map silently drifts from what the admin set. The billing
`/billing/summary` endpoint was the easy one to miss — it returns `features` to
the client and originally used the static map.

## Dandy enterprise guard
The canonical "protected enterprise" enforcement point is `getTenantPlan()`
(slug guard: `dandy`, `dandy-smb` → always `enterprise`, regardless of stored
plan or Stripe). Surfaces that derive a tenant's tier via
`normalizePlan(row.plan)` **bypass** that guard. `billing.ts` now routes
through `getTenantPlan`. `auth.ts` (/me) and `tenantSettings.ts` still use
`normalizePlan(row.plan)` — pre-existing; safe only while Dandy's stored plan
column is `enterprise`. If you ever need defense-in-depth there, switch them to
`getTenantPlan`.

## Cache invalidation
`getPlanConfig` caches 60s with in-flight dedup. `bustPlanConfigCache()` clears
the cache AND bumps a `generation` counter so a load started before the bust
can't repopulate stale data after it resolves. Call bust after any SuperAdmin
write to plan_config (write path lands in a later phase).
