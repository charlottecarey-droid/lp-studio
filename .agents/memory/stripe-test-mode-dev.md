---
name: Stripe test mode in dev only (live untouched)
description: How to run Stripe TEST-mode fake payments in dev without switching the published live app to test mode.
---

# Stripe test mode in dev without touching live

`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_ENABLED` are **global Replit Secrets injected into BOTH dev and prod**. So overwriting `STRIPE_SECRET_KEY` (or `requestEnvVar` on it) would flip the LIVE published app to test mode — never do that.

**Mechanism (prod-safe):**
- Add a NEW global secret `STRIPE_SECRET_KEY_TEST` (an `sk_test_*` key). Global is safe because only a dev-gated branch reads it.
- `artifacts/api-server/src/loadEnv.ts` runs only when `NODE_ENV !== "production"`. Inside that branch, when `STRIPE_SECRET_KEY_TEST` is set: remap it onto `process.env.STRIPE_SECRET_KEY` and **blank** `STRIPE_WEBHOOK_SECRET` (unless `STRIPE_WEBHOOK_SECRET_TEST` given). Prod skips loadEnv entirely → live keys never overridden.
- Webhook verify in dev: the route's `getWebhookSecret()` (stripeClient.ts) has a DB fallback — when env secret is blank it reads `stripe._managed_webhooks.secret` scoped by the current webhook URL (`getManagedWebhookUrl()`, shared with server.ts's `findOrCreateManagedWebhook`). The boot creates a fresh **test** managed webhook (live one is rejected: "a similar object exists in live mode, but a test mode key was used") and stores its `whsec_` secret. In prod `STRIPE_WEBHOOK_SECRET` is always set, so the fallback never runs.

**Why URL-scoped:** dev and prod share the prod Neon DB, so `_managed_webhooks` holds rows for multiple URLs. Live (prod host) vs test (dev host) webhook rows differ by URL; scoping the fallback `WHERE url = $1` keeps them from crossing.

**Seed trap:** `pnpm --filter @workspace/scripts ... seed-stripe-products` reads `STRIPE_SECRET_KEY` from the SHELL, where the global LIVE key is present → would seed LIVE. Run it with the test key explicit: `STRIPE_SECRET_KEY="$STRIPE_SECRET_KEY_TEST" pnpm ... seed-stripe-products`. Verify created prices have `livemode:false`.

**Test card:** 4242 4242 4242 4242, any future expiry / any CVC / any ZIP. Shared-DB caveat: a test checkout writes a test customer/sub onto the chosen tenant + syncs `livemode:false` rows into the shared `stripe.*` schema — rehearse on a throwaway/test tenant, not a real one.
