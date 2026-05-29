# 5-Tier Pricing + Gate Enforcement — Implementation Plan

> Status: **AWAITING APPROVAL**. This is the documented plan the user asked for.
> Nothing in here is built yet. Each phase stops for review before the next begins.

## Goals (from the user)

1. **Get Stripe working** across the full self-serve tier ladder (not just one tier).
2. **Actually enforce every gate** in the marketing feature map — provable with tests,
   not just claimed.
3. **Both Dandy tenants stay Enterprise**, untouched by any refactor or webhook.
4. **Everything configurable in SuperAdmin** — tier display names, prices, and caps are
   editable values, not hardcoded constants.

## Reality check — what already exists (do NOT rebuild)

The codebase is far more built-out than the original task spec assumes:

- Stripe is already wired end-to-end (shipped as "Task #425, Phase 3"):
  `stripeClient.ts` (env key + Replit connector fallback), `stripeWebhook.ts`
  (signature-verified dispatcher), `billing.ts` (summary / checkout / portal),
  `BillingPage.tsx`, `UpgradePrompt.tsx`, SuperAdmin drift warning, idempotent
  `seed-stripe-products.ts`, migration `0029_tenants_stripe.sql`, and a manual test
  plan in `docs/packaging/stripe-test-plan.md`.
- The "Powered by" badge **is** plan-gated today (`triggerPublishedRender.ts` →
  `showPoweredByBadge = plan === "starter"`). It just needs re-keying to `free`.
- Page caps, form caps, and **user-seat caps are already enforced** (`lp/pages.ts`,
  `lp/forms.ts`, `admin.ts` member-invite). They need new numbers, not new middleware.
- A SuperAdmin plan override **already exists** (`PATCH /superadmin/tenants/:id`,
  validates against `PLANS`, only nags when a *live* Stripe sub exists).

So the real work is: (a) split the single free floor into `free` + paid `starter`,
(b) move tier definitions from hardcoded constants into editable SuperAdmin config,
(c) extend Stripe from 1 self-serve tier to 3, (d) add the genuinely-missing meters,
(e) lock Dandy as Enterprise.

## The tier model

Canonical internal keys (stable, never renamed — used in code, Stripe metadata, DB):

| Key          | Default display name | Self-serve? | Monthly | Annual (per mo) | Badge |
|--------------|----------------------|-------------|---------|------------------|-------|
| `free`       | Free                 | n/a         | $0      | $0               | yes   |
| `starter`    | Starter              | Stripe      | $59     | $49              | no    |
| `growth`     | Growth               | Stripe      | $249    | $199             | no    |
| `scale`      | Scale                | Stripe      | $649    | $499             | no    |
| `enterprise` | Enterprise           | sales       | —       | —                | no    |

Annual is billed yearly at the per-month rate × 12 (Starter $588/yr, Growth $2,388/yr,
Scale $5,988/yr).

Default caps (editable in SuperAdmin):

| Cap   | free | starter | growth | scale | enterprise |
|-------|------|---------|--------|-------|------------|
| pages | 1    | 10      | ∞      | ∞     | ∞          |
| forms | 1    | 5       | ∞      | ∞     | ∞          |
| seats | 1    | 3       | 10     | 25    | ∞          |

Default feature flags per tier (also editable): `salesConsole`, `aiImageGen`,
`customDomain`, monthly AI quota, heatmap session quota, and the "Powered by" badge.

## Plan-string reconciliation (the riskiest part)

Today the ladder is 3 tiers (`starter | growth | enterprise`) where `starter` **is**
the free floor. The new model makes `free` the floor and `starter` a *paid* tier — so
the word "starter" flips meaning. Mapping for existing rows (`normalizePlan`):

- legacy `starter` → **`free`** (today's free-floor tenants; per user decision)
- `trial`, `business` → `growth` (keep legacy paid behavior — no surprise downgrade)
- `pro`, `enterprise` → `enterprise` (keep — protects Dandy)
- unknown / null → **`free`**
- `tenants.plan` column default changes `trial` → `free` for new signups

## Dandy safeguard (must stay Enterprise)

Both Dandy tenants are sales-assisted with **no Stripe subscription**, so the webhook
never touches them. Belt-and-suspenders on top:

- **Tenant 1 — `dandy` (Enterprise):** app `ent.meetdandy.com`, landing pages
  `partners.meetdandy.com`. Confirmed `plan = enterprise` in the dev DB.
- **Tenant 5 (unconfirmed id) — `dandy-smb`:** app `meetdandy-lp.com`, subdomain
  `lp.meetdandy.com`. Lives in production; id to be verified at apply time.

Safeguard: a hard guard that forces any tenant whose **slug** is `dandy` or `dandy-smb`
to resolve to `enterprise`, regardless of stored value or webhook. Backed by a unit test
asserting both slugs → `enterprise` and that all Enterprise features (sales console,
AI image gen, unlimited caps, no badge) resolve true. Slug-based (not id-based) so it is
environment-independent.

## SuperAdmin-configurable plan definitions

Move tier definitions out of the hardcoded `PLAN_FEATURES` constant into a DB-backed,
SuperAdmin-editable config (cached in the API, with the current constants as the seeded
defaults / fallback). Editable per tier: display name, monthly price, annual price,
caps (pages / forms / seats), and feature flags.

**Price caveat:** Stripe prices are immutable. Editing a price in SuperAdmin updates the
display + drives a re-seed that creates a *new* Stripe price and archives the old one;
existing subscribers keep their original price until they re-checkout. This will be
called out clearly in the UI. Caps, names, and feature flags take effect immediately (no
Stripe involved). Canonical tier keys are NOT editable (they anchor code + Stripe
metadata).

**Cache strategy:** the config accessor caches the resolved plan-config map
**in-memory, per-process, with a 60s TTL**. A SuperAdmin save **busts the cache
immediately in the saving process** so the editor sees changes instantly; other API
processes converge within the 60s TTL. No cross-process pub/sub — the short TTL is the
convergence mechanism. The hardcoded defaults remain the fallback if the config row is
missing or unreadable.

**Structured 402 shape (all gates):** every plan gate — counts (pages/forms/seats) and
feature flags (salesConsole/aiImageGen/customDomain/quotas) — returns the **same** JSON
body on a 402, so the client can render one consistent upgrade prompt:

```json
{
  "error": "plan_upgrade_required",
  "gate": "pages",
  "currentUsage": 10,
  "cap": 10,
  "currentPlan": "starter",
  "minimumPlanWithFeature": "growth",
  "upgradeUrl": "/settings/billing"
}
```

For boolean feature gates (no numeric cap), `currentUsage` and `cap` are `null` and
`gate` is the feature key (e.g. `"salesConsole"`). `minimumPlanWithFeature` is the
lowest tier whose config satisfies the gate.

**P2 features (multi-workspace, SSO/SAML, custom blocks, etc.):** these are carried as
**data-only flags** in the config map and surfaced in the UI as **locked / upgrade
states**, but have **NO server-side middleware enforcement yet**. The feature map stays
complete and honest (it never claims enforcement that isn't wired). Real gates for these
land in a later pass, not in this plan's phases.

## Phases (each stops for approval)

### Phase 0 — Tier model + Dandy safeguard
Add the 5 canonical tiers, rewrite `normalizePlan` per the reconciliation table, add the
slug-based Dandy guard + test, change the DB column default to `free`. No behavior change
for existing tenants yet. Done: typecheck green, Dandy guard test green.

### Phase 1 — SuperAdmin-configurable FEATURE_MAP
Introduce the DB-backed plan-config table seeded from current defaults, a cached accessor
the backend reads instead of the hardcoded map, and one shared map consumed by backend
gating, marketing `Pricing.tsx`, and the (currently stale) frontend `plan-features.ts`. A
drift test fails if marketing and backend diverge. Done: pricing table and gates read the
same data; editing config in SuperAdmin changes caps live.

### Phase 2 — Extend Stripe to 3 self-serve tiers
Add `starter` / `growth` / `scale` monthly + annual lookup keys to `stripePlanMapping.ts`
and `seed-stripe-products.ts` with the prices above; archive the old $199 growth prices;
re-seed (test mode first, then live). Webhook maps each lookup key back to its tier. Done:
Checkout works for all three paid tiers; round-trip mapping test green.

### Phase 3 — SuperAdmin tier override + price editing
Extend the existing plan dropdown + `PATCH /superadmin/tenants/:id` to all 5 tiers for
instant per-tenant tier switching (ideal for testing). Add the plan-config editing UI
(names / prices / caps / flags) with the Stripe price-immutability caveat surfaced. Done:
any test tenant can be flipped to any tier and see gates change; config edits persist.

### Phase 4 — Enforce every gate
P0 (genuinely missing): monthly AI-generation quota, heatmap session metering, re-key the
"Powered by" badge `starter` → `free`. P1 (exists, new numbers): wire page / form / seat
caps to the config. Each gate gets a cap+1 contract test returning a structured 402. Done:
every enforced gate has a passing over-limit test.

### Phase 5 — Billing UI + end-to-end verification
Extend `BillingPage.tsx` / `UpgradePrompt.tsx` to 5 tiers with monthly/annual toggle and
structured-402 upgrade prompts; end-to-end Checkout test against a Stripe test clock. Done:
a tenant can self-upgrade through Checkout and the gates open immediately.

## Out of scope
- Proration / mid-cycle upgrade math beyond Stripe defaults.
- Usage-based / metered Stripe billing (quotas are enforced app-side, not billed per-unit).
- Migrating the existing custom webhook to the `stripe-replit-sync` pattern (both coexist;
  the custom webhook remains the source of truth for `tenants.plan`).

## Relevant files
- `artifacts/api-server/src/lib/planFeatures.ts`
- `artifacts/api-server/src/lib/stripePlanMapping.ts`
- `artifacts/api-server/src/lib/triggerPublishedRender.ts:400-432`
- `artifacts/api-server/src/routes/billing.ts`
- `artifacts/api-server/src/routes/stripeWebhook.ts`
- `artifacts/api-server/src/routes/admin.ts:444-470,1035-1070`
- `artifacts/api-server/src/routes/lp/pages.ts`
- `artifacts/api-server/src/routes/lp/forms.ts`
- `artifacts/api-server/src/routes/lp/heatmap.ts`
- `artifacts/lp-studio/src/marketing/components/Pricing.tsx`
- `artifacts/lp-studio/src/lib/plan-features.ts`
- `artifacts/lp-studio/src/pages/settings/BillingPage.tsx`
- `artifacts/lp-studio/src/components/UpgradePrompt.tsx`
- `artifacts/lp-studio/src/pages/SuperAdminPage.tsx`
- `scripts/src/seed-stripe-products.ts`
- `docs/packaging/stripe-test-plan.md`
