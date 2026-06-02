-- Task: default email sender + plan-gating groundwork.
--
-- Two new plan-feature booleans on plan_config for the email sending tiers
-- that the custom-domain tasks build on:
--   branded_email_subdomain (Tier 2) — auto-provisioned branded subdomain.
--   custom_email_domain     (Tier 3) — tenant's own fully custom domain.
--
-- Both default OFF so the sender resolver always fails closed to the Tier 1
-- shared default sender (mail.lpstudio.ai). Backfilled per the canonical
-- defaults in @workspace/plan-config:
--   branded subdomain → growth, scale, enterprise (mid / paid tiers)
--   custom domain     → enterprise only
--
-- Idempotent: ADD COLUMN IF NOT EXISTS + tier-scoped UPDATEs.

ALTER TABLE plan_config
  ADD COLUMN IF NOT EXISTS branded_email_subdomain boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS custom_email_domain     boolean NOT NULL DEFAULT false;

UPDATE plan_config SET branded_email_subdomain = true
 WHERE tier IN ('growth', 'scale', 'enterprise');

UPDATE plan_config SET custom_email_domain = true
 WHERE tier IN ('enterprise');
