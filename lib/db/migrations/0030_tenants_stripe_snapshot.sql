-- Task #425 — Stripe billing snapshot columns.
--
-- The Billing settings page must hydrate from a local snapshot (no
-- per-pageload Stripe API call). The webhook is the single writer of
-- these columns: every customer.subscription.{created,updated,deleted}
-- event refreshes the snapshot, and checkout.session.completed seeds it
-- right after a successful Checkout.
--
-- All columns are nullable + safe to read in any order: the Billing UI
-- renders "—" for any missing field, so a brand-new install (no
-- subscriptions yet) and an in-flight migration where the webhook hasn't
-- replayed yet both degrade gracefully.
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS stripe_subscription_status   TEXT,
  ADD COLUMN IF NOT EXISTS stripe_current_period_end    BIGINT,
  ADD COLUMN IF NOT EXISTS stripe_cancel_at_period_end  BOOLEAN,
  ADD COLUMN IF NOT EXISTS stripe_price_lookup_key      TEXT,
  ADD COLUMN IF NOT EXISTS stripe_unit_amount           BIGINT,
  ADD COLUMN IF NOT EXISTS stripe_currency              TEXT,
  ADD COLUMN IF NOT EXISTS stripe_cadence               TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_brand         TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_last4         TEXT;
