# Smart Traffic / AI Visitor Routing — Implementation Plan

## Overview

Smart Traffic replaces random A/B test assignment with intelligent routing. Instead of splitting visitors 50/50 and waiting weeks for statistical significance, it learns which variant converts best for different visitor profiles and routes accordingly. Unbounce reports ~30% conversion lift from this approach.

## Architecture

### Phase 1: Feature Collection (1-2 hours)

Extend the existing session/tracking system to capture visitor features at assignment time.

**Modify `lpSessionsTable` schema** — add a JSONB `features` column:
```typescript
features: jsonb("features").notNull().default({})
```

Features to collect (server-side in `tracking.ts`):
- `device`: mobile / tablet / desktop (from User-Agent)
- `browser`: chrome / safari / firefox / edge / other
- `os`: windows / macos / ios / android / linux / other
- `country`: from existing geoip lookup
- `region`: from existing geoip lookup
- `dayOfWeek`: 0-6 (Sunday-Saturday)
- `hourOfDay`: 0-23 (in UTC)
- `referrerDomain`: extracted from Referer header
- `utmSource`: from query params
- `utmMedium`: from query params
- `isReturning`: boolean (check if sessionId has prior visits)

All features are categorical (bucketed) for the algorithm. No PII is stored.

**Files to modify:**
- `lib/db/src/schema/` — add `features` column to `lpSessionsTable`
- `artifacts/api-server/src/routes/lp/tracking.ts` — collect features in `GET /lp/page/:slug`

### Phase 2: Thompson Sampling Algorithm (2-3 hours)

Implement a multi-armed bandit using Thompson Sampling. This is the same algorithm Unbounce uses — it balances exploration (trying underperforming variants) with exploitation (routing to the best variant).

**Create `artifacts/api-server/src/lib/smart-traffic.ts`:**

```
Algorithm: Contextual Thompson Sampling
─────────────────────────────────────────

For each variant V and feature-bucket F:
  - Track: successes (conversions) and failures (impressions - conversions)
  - Model: Beta(α, β) where α = successes + 1, β = failures + 1

On new visitor with features F:
  1. For each variant V:
     a. Look up the Beta distribution for the most relevant feature bucket
     b. Sample a random value from Beta(α, β)
  2. Route visitor to the variant with the highest sampled value
  3. Record the assignment + features

This naturally balances:
  - Exploration: variants with few data points have wide distributions
  - Exploitation: variants with high conversion rates sample higher values
```

**Feature bucketing strategy:**
- Combine top 2-3 most predictive features into composite keys
- Example: `device:mobile|country:US` → separate Beta distribution per variant
- Start with device + country as the default context dimensions
- Fall back to global (no context) when a bucket has < 30 observations

**Data storage:**
- Add an `lpSmartTrafficStats` table:
  ```
  id, testId, variantId, featureBucket (text), successes (int), failures (int), updatedAt
  ```
- Compound unique index on (testId, variantId, featureBucket)
- Update on every conversion event (increment successes) and impression event (increment failures)

**Files to create:**
- `artifacts/api-server/src/lib/smart-traffic.ts` — Thompson Sampling implementation
- `lib/db/src/schema/lpSmartTraffic.ts` — stats table schema

**Files to modify:**
- `artifacts/api-server/src/routes/lp/tracking.ts` — replace random assignment with smart routing when enabled
- `POST /lp/track` — update stats on impression/conversion events

### Phase 3: Test Configuration UI (1-2 hours)

Add a "Smart Traffic" toggle to the test creation/management UI.

**Add to test schema:**
- `smartTrafficEnabled: boolean` column on `lpTestsTable` (default false)
- `smartTrafficMinSamples: integer` (default 100) — minimum total impressions before smart routing kicks in

**Builder UI changes:**
- Toggle switch in test settings: "Enable Smart Traffic"
- Tooltip explaining what it does
- Warning that it requires at least 100 impressions to start learning
- Show current learning status: "Learning (47/100 impressions)" → "Active — routing optimized"

**Files to modify:**
- `lib/db/src/schema/` — add columns to `lpTestsTable`
- `artifacts/lp-studio/src/pages/create-test.tsx` — add toggle
- `artifacts/lp-studio/src/pages/test-detail/` — show smart traffic status

### Phase 4: Performance Dashboard (1-2 hours)

Show how Smart Traffic is performing vs. random assignment.

**Add to results tab:**
- "Smart Traffic Lift" metric card showing estimated improvement over random 50/50
- Per-variant breakdown: which segments are being routed where
- Feature importance: which visitor features most predict conversion
- A "Smart Traffic Distribution" chart showing how traffic is being allocated over time

**Calculation:**
```
Estimated lift = (smart_cvr - baseline_cvr) / baseline_cvr × 100%

Where:
  smart_cvr = weighted average CVR across all buckets using smart allocation
  baseline_cvr = overall CVR if traffic were split evenly
```

**Files to modify:**
- `artifacts/api-server/src/routes/lp/results.ts` — add smart traffic stats to response
- `artifacts/lp-studio/src/pages/test-detail/results-tab.tsx` — add dashboard section

### Phase 5: Monitoring & Safety (1 hour)

- **Exploration floor**: Always send at least 10% of traffic randomly to prevent the algorithm from getting stuck
- **Convergence detection**: If one variant is getting >90% of traffic consistently, flag it as a potential winner
- **Auto-pause**: If a variant's conversion rate drops below a threshold, reduce its allocation automatically
- **Reset button**: Allow users to reset smart traffic stats and re-learn

## Implementation Order

```
Phase 1 (features)  →  Phase 2 (algorithm)  →  Phase 3 (UI toggle)
                                              →  Phase 4 (dashboard)
                                              →  Phase 5 (safety)
```

Phases 3-5 can be built in parallel after Phase 2 is complete.

## Estimated Total: 6-10 hours of implementation

## Key Decision Points

1. **Feature dimensions**: Start with device + country, or go wider?
   - Recommendation: Start narrow (device + country), add more later based on data

2. **Learning period**: How many impressions before smart routing activates?
   - Recommendation: 100 total impressions (not per variant)

3. **Exploration rate**: What % of traffic should always be random?
   - Recommendation: 10% exploration floor

4. **Storage**: Real-time stats table vs. periodic aggregation?
   - Recommendation: Real-time stats table with atomic increment operations

## Dependencies

- No new npm packages needed
- No external API calls (runs entirely server-side)
- Uses existing PostgreSQL + Drizzle ORM
- Uses existing geoip-lite for location features
