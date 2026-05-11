-- Tenant slug redirect expiry notification (task #152)
--
-- Why
-- ───
-- Old workspace URLs keep redirecting for 90 days after a rename, but
-- nobody sees the expiry date unless they happen to visit Settings.
-- A scheduled job (see api-server `notifyExpiringSlugRedirects`) emails
-- workspace admins about a week before each redirect dies so they can
-- extend (re-rename) or warn affected users in time.
--
-- `notified_at` is set the first time the warning email is sent for a
-- given row so re-runs of the scheduled job never spam admins about the
-- same expiry twice.
ALTER TABLE tenant_slug_redirects
  ADD COLUMN IF NOT EXISTS notified_at timestamptz;
