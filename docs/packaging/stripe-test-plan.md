# Stripe billing — test plan (Task #425, Phase 3)

This document is the manual + automated test plan for the self-serve
billing surface added in Phase 3. Use it when bringing up a new Stripe
account, when upgrading the `stripe` SDK, or before promoting changes
that touch any of the files listed under *Surface*.

## Surface

- `artifacts/api-server/src/lib/stripeClient.ts` — credential resolver
  (env-first, Replit connector fallback)
- `artifacts/api-server/src/lib/stripePlanMapping.ts` — lookup_key ↔ plan
- `artifacts/api-server/src/routes/stripeWebhook.ts` — webhook dispatcher
- `artifacts/api-server/src/routes/billing.ts` — summary / checkout /
  portal routes
- `artifacts/api-server/src/app.ts` — webhook mounted BEFORE
  `express.json()`
- `artifacts/api-server/src/server.ts` — `STRIPE_ENABLED` startup log
- `artifacts/lp-studio/src/pages/settings/BillingPage.tsx` — settings UI
- `artifacts/lp-studio/src/components/UpgradePrompt.tsx` — checkout
  rewire
- `artifacts/lp-studio/src/pages/SuperAdminPage.tsx` — drift warning
- `scripts/src/seed-stripe-products.ts` — idempotent product seeder
- `lib/db/migrations/0029_tenants_stripe.sql` — DB columns

## Environment matrix

| Mode                         | Required env                                              |
|------------------------------|-----------------------------------------------------------|
| Portable (Render/EC2/CI)     | `STRIPE_ENABLED=1`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| Replit (workspace connector) | `STRIPE_ENABLED=1`, Stripe integration connected          |
| Stripeless dev               | (unset)                                                   |

In stripeless dev the API still boots and serves everything except
`/api/billing/*` (these return `503 {"error":"Billing is not configured…"}`).
The Billing settings page renders the soft-disabled state.

## One-time setup

```bash
# 1. Install (already in lockfile)
pnpm install

# 2. Run migrations (creates tenants.stripe_customer_id /
#    stripe_subscription_id + partial unique indexes)
pnpm --filter @workspace/api-server run migrate

# 3. Seed test-mode catalog (idempotent)
STRIPE_SECRET_KEY=sk_test_… \
  pnpm --filter @workspace/scripts run seed-stripe-products
```

The seed script prints the resulting lookup keys. They must exactly
match the constants in `stripePlanMapping.ts`:

- `growth_monthly`
- `growth_annual`

## Local webhook forwarding

```bash
stripe listen --forward-to http://localhost:$PORT/api/stripe/webhook
# copy the printed whsec_… into STRIPE_WEBHOOK_SECRET
```

## Test scenarios

### T1. Boot diagnostics

- With `STRIPE_ENABLED=1` + `STRIPE_SECRET_KEY` set → log line
  `[stripe] enabled via STRIPE_SECRET_KEY env var (portable mode)`
- With `STRIPE_ENABLED=1` only (connector path) →
  `[stripe] enabled via Replit connector broker (workspace integration)`
- With `STRIPE_ENABLED` unset →
  `[stripe] disabled (STRIPE_ENABLED unset) — billing routes will respond 503`

### T2. Self-serve upgrade (happy path)

1. Sign in as a starter-tenant workspace admin.
2. Settings → Billing → "Subscribe" under Growth · Monthly.
3. Stripe Checkout opens, complete with test card `4242 4242 4242 4242`.
4. Redirected to `/settings/billing?status=success` → toast appears.
5. Within ~1s the page re-polls and shows:
   - Plan badge = Growth, status badge = active
   - Renewal date populated
   - "Manage billing" button visible
6. DB invariant: `tenants.stripe_customer_id` and
   `tenants.stripe_subscription_id` are both populated; `plan` = `growth`.
7. Console log: `[admin][audit] tenant.plan.changed` with
   `source:"stripe_webhook"` and a `stripeEventId`.

### T3. Annual cadence

Same as T2 but click the Annual tile. The summary should show
`Billing: annual` and the price should match `$1,990 / year`.

### T4. Portal — cancel at period end

1. From Billing settings click "Manage billing".
2. In the Stripe portal, cancel the subscription.
3. Return to Billing settings. Within seconds the page should show:
   - Status badge still `active`
   - "Cancels on …" instead of "Renews on …"
   - Amber notice about end-of-period cancellation

### T5. Portal — re-activate

After T4, re-activate from the portal. The amber notice goes away on
next load and the row reverts to "Renews on …".

### T6. Payment failure → downgrade

1. With an active Growth subscription, use the Stripe CLI to simulate:
   ```
   stripe trigger invoice.payment_failed
   ```
   The webhook logs an `invoice.payment_failed` line but the plan
   doesn't change yet.
2. Then trigger `customer.subscription.updated` with `status=unpaid` (or
   wait for Stripe to mark the sub `unpaid` after smart retries). The
   tenant flips to `starter`.

### T7. Subscription deleted

```
stripe trigger customer.subscription.deleted
```
Tenant plan flips to `starter`; audit log emits with the deletion event
id.

### T8. SuperAdmin drift warning

1. As a superadmin operator, open the SuperAdmin page.
2. A tenant with `stripe_subscription_id` set shows an amber warning
   above the plan dropdown.
3. Manually patch the plan to `enterprise` via the dropdown — the
   warning explains the next webhook will overwrite it. Confirm by
   triggering `customer.subscription.updated`; the tenant returns to
   whatever tier the active subscription's lookup_key resolves to.

### T9. Non-admin guardrails

Sign in as a non-admin tenant member:

- Sidebar "Billing" item IS visible to all authenticated workspace
  members (Phase 3 rev 5: hiding it made the page undiscoverable).
- `/settings/billing` renders in read-only mode: current plan, renewal
  date, and payment-method tile are visible. The "Upgrade to Growth"
  and "Manage billing" buttons are disabled with a "Only workspace
  admins can upgrade." hint.
- POST `/api/billing/checkout-session` returns `403 { error: "Workspace admin required" }`
- POST `/api/billing/portal-session` returns `403 { error: "Workspace admin required" }`

### T10. Stripeless dev

With `STRIPE_ENABLED` unset:

- API boots fine, all non-billing routes work.
- `GET /api/billing/summary` returns 200 with
  `stripe.configured = false`; UI renders the current plan + bullets
  without Checkout/Portal buttons.
- `POST /api/billing/checkout-session` returns `503`.

### T11. UpgradePrompt rewire

1. As a starter tenant, hit `/sales` (or any other gated route).
2. The `<UpgradePrompt>` renders with "Upgrade to Growth" as the
   primary CTA (no mailto).
3. Clicking it starts a Checkout session for `growth_monthly`.
4. As a starter member (not admin), the CTA POSTs and surfaces a toast:
   "Workspace admin required".

### T12. Webhook signature failure

Curl the webhook endpoint with a body but no `stripe-signature` →
`400 { "error": "Missing stripe-signature header" }`. With a bogus
signature → `400 { "error": "Invalid signature: …" }`.

## Automated checks worth wiring later

- E2E: starter→growth Checkout happy path with the Stripe test clock.
- Unit: `planForLookupKey` round-trip with `lookupKeyFor`.
- Contract: webhook dispatcher with a hand-crafted
  `customer.subscription.updated` event flips `tenants.plan`.
