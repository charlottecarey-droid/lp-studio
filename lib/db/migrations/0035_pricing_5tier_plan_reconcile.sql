-- Phase 0 of the 5-tier pricing reconciliation
-- (docs/packaging/pricing-5-tier-implementation-plan.md).
--
-- The ladder changes from 3 tiers (starter|growth|enterprise, where
-- `starter` was the FREE floor) to 5 tiers (free|starter|growth|scale|
-- enterprise, where `free` is the floor and `starter` is now a PAID
-- tier). Three idempotent, additive changes:
--
--   1. Default new signups to `free` (was effectively `trial` → growth).
--   2. Rewrite legacy free-floor rows (`plan='starter'`) to `free` so the
--      string `starter` is freed up to mean the new paid tier. This is
--      safe: the only real tenants are the two Dandy workspaces (both
--      enterprise); everything else is a test tenant.
--   3. Belt-and-suspenders: force the two Dandy workspaces to enterprise
--      at the data level too (the app-layer guard in planFeatures.ts is
--      the primary safeguard; this keeps the stored value honest).
--
-- All statements are guarded / idempotent — safe to re-run.

ALTER TABLE tenants ALTER COLUMN plan SET DEFAULT 'free';

UPDATE tenants SET plan = 'free'
  WHERE lower(plan) = 'starter';

UPDATE tenants SET plan = 'enterprise'
  WHERE lower(slug) IN ('dandy', 'dandy-smb')
    AND plan IS DISTINCT FROM 'enterprise';
