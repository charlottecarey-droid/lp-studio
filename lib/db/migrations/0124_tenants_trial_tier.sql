-- Per-tenant trial tier for the founding-beta offer.
--
-- The standard 14-day trial lifts a tenant to a CONSTANT tier (Growth, in
-- @workspace/plan-config). The beta grants a 365-day trial at Scale, which
-- needs the tier to vary per tenant. NULL = the standard constant, so every
-- existing row and code path is unchanged.
--
-- Riding the trial machinery on purpose: expiry stays purely clock-based
-- (effectivePlan falls back to the stored plan), Stripe still owns the stored
-- plan, and no new downgrade mechanism exists to go wrong.
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS trial_tier text
  CHECK (trial_tier IS NULL OR trial_tier IN ('free','starter','growth','scale','enterprise'));
