-- Retire the legacy plan='trial' default.
--
-- Before the automatic 14-day Growth trial, new tenants defaulted to
-- plan='trial', which normalizePlan() maps to Growth — silently granting
-- Growth entitlements for free, indefinitely, to any tenant created without
-- an explicit plan. Trials are now represented by the trial_started_at /
-- trial_expires_at window (see 0039), so the stored `plan` floor must default
-- to 'free'. Production creation paths (signup, admin create) set the plan
-- explicitly; this changes only the fallback for any path that omits it.
ALTER TABLE tenants ALTER COLUMN plan SET DEFAULT 'free';
