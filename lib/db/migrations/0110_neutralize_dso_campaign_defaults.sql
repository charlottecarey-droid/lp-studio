-- dso_email_campaigns was created (0000) with Dandy-branded column defaults:
--   sender_name    DEFAULT 'Dandy DSO Partnerships'
--   sender_email   DEFAULT 'partnerships'
--   reply_to_email DEFAULT 'sales@meetdandy.com'
--   utm_source     DEFAULT 'dandy_dso'
-- The only consumer (routes/dso — the cancelled standalone DSO console) is
-- intentionally unmounted, but the defaults are a standing footgun: any
-- future INSERT that omits the sender fields silently bakes Dandy's identity
-- into another tenant's outbound email. Drop the defaults so sender identity
-- MUST be supplied explicitly (per-tenant brand settings) — an INSERT that
-- omits the NOT NULL sender columns now fails instead of impersonating Dandy.
-- utm_source simply becomes NULL when unset. Existing rows (Dandy's own
-- campaigns) keep their stored values; utm_medium's 'email' default is
-- brand-neutral and stays.
ALTER TABLE dso_email_campaigns
  ALTER COLUMN sender_name    DROP DEFAULT,
  ALTER COLUMN sender_email   DROP DEFAULT,
  ALTER COLUMN reply_to_email DROP DEFAULT,
  ALTER COLUMN utm_source     DROP DEFAULT;
