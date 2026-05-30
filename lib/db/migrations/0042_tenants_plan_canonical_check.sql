-- Defense-in-depth for the trial authorization model: lock tenants.plan to
-- the canonical 5-tier set so no legacy alias (e.g. 'trial', 'business',
-- 'pro') can ever be persisted again.
--
-- Why: `normalizePlan("trial")` maps to Growth as a READ-side backward-compat
-- alias. A *stored* plan='trial' therefore silently grants Growth entitlements
-- indefinitely, bypassing the bounded 14-day trial window (trial_started_at /
-- trial_expires_at over a 'free' floor). 0039/0040 retired the 'trial' default
-- and moved existing rows down; this constraint makes the invariant structural
-- so the gap cannot reopen even if an unvalidated write path slips through.
--
-- All statements are idempotent — safe to re-run.

-- Coerce any lingering non-canonical stored plan down to the Free floor before
-- locking the column. The two protected Dandy workspaces are already
-- 'enterprise' (canonical) and are untouched by this.
UPDATE tenants
   SET plan = 'free'
 WHERE plan NOT IN ('free', 'starter', 'growth', 'scale', 'enterprise');

-- Drop any prior version of the constraint so this file is safe to re-run.
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_plan_canonical_check;

ALTER TABLE tenants
  ADD CONSTRAINT tenants_plan_canonical_check
  CHECK (plan IN ('free', 'starter', 'growth', 'scale', 'enterprise'));
