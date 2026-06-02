---
name: plan-config feature flag composite dist
description: Adding a plan feature flag needs the plan-config (and db) composite dists rebuilt, or consumer tsc reports phantom "property does not exist on PlanFeatures".
---

Adding a new boolean to `PlanFeatures` touches `lib/plan-config/src/index.ts` (the
type + every tier's defaults) and `lib/db/src/schema/planConfig.ts` (the column).
Both are **composite TypeScript projects** consumed via their built `dist/*.d.ts`,
not their source. After editing the source you MUST rebuild the dist or every
consumer (api-server `planConfig.ts`, `planGate.ts` `BooleanFeatureKey`, the
`requirePlanFeature("…")` callsites, `planFeatures.test.ts`) fails typecheck with
`Property 'xxx' does not exist on type 'PlanFeatures'` even though source + runtime
are correct.

**How to apply:** run `npx tsc -b lib/db --force` then `npx tsc -b lib/plan-config --force`
(force — incremental `tsc -b` can no-op and leave the stale `.d.ts`). Same pattern
as lib-db / one-pager-types composite dists.

**Why:** the gate's `BooleanFeatureKey` is derived from `PlanFeatures`; a stale dist
makes a perfectly valid `requirePlanFeature("newFlag")` look like a type error and
blocks the whole api-server typecheck.
