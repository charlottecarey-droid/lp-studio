-- Page-level cookie-consent banner opt-in (Aug 2026).
--
-- The consent banner bootstrap in index.html used to auto-show on the
-- tracking hosts (lp.meetdandy.com / partners.meetdandy.com) for every
-- visitor without a stored choice — which double-bannered pages whose GTM
-- stack already ships OneTrust. The banner is now opt-in per page: the
-- bootstrap only renders it when the published page being viewed has this
-- flag set (the viewer calls window.__lpConsent.showBanner()). Default
-- false = no banner, matching the new product default. Consent-mode
-- defaults and the __lpConsent API are unaffected.
ALTER TABLE lp_pages
  ADD COLUMN IF NOT EXISTS show_cookie_banner boolean NOT NULL DEFAULT false;
