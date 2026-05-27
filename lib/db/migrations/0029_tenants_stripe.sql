-- Task #425 — Stripe billing. Persist the Stripe customer/subscription ids
-- alongside the tenant so the webhook can lookup-by-id (O(1)) instead of
-- scanning the table, and so the SuperAdmin "stripe-managed" drift banner
-- can light up whenever a subscription is attached.
--
-- Plan stays in the existing tenants.plan column (free-form text, normalised
-- by planFeatures.ts). Stripe is authoritative ONLY for *tier*; PLAN_FEATURES
-- remains the source of truth for what each tier unlocks.
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS stripe_customer_id     TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS tenants_stripe_customer_id_uq
  ON tenants (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS tenants_stripe_subscription_id_uq
  ON tenants (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;
