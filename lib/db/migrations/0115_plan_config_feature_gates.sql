-- Feature-gating follow-up to the July 2026 pricing audit: three capabilities
-- the pricing page advertises as tier-gated but the backend never enforced.
--
--   smart_traffic      — enabling/resetting Smart Traffic routing on an A/B
--                        test (visitor-side assignment is never gated).
--   custom_blocks      — authoring custom blocks (create/edit/generate/compose;
--                        reads and deletes stay open so existing pages render).
--   programmatic_pages — the programmatic-pages + DTR-rules surface.
--   multi_workspace    — creating additional workspaces (multi-brand);
--                        switching between existing memberships is never gated.
--
-- All default OFF (fail closed). Backfilled per the canonical defaults in
-- @workspace/plan-config, matching the marketing feature map:
--   smart_traffic / custom_blocks → growth, scale, enterprise
--   programmatic_pages / multi_workspace → scale, enterprise
--
-- Idempotent: ADD COLUMN IF NOT EXISTS + tier-scoped UPDATEs.

ALTER TABLE plan_config
  ADD COLUMN IF NOT EXISTS smart_traffic      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS custom_blocks      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS programmatic_pages boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS multi_workspace    boolean NOT NULL DEFAULT false;

UPDATE plan_config SET smart_traffic = true
 WHERE tier IN ('growth', 'scale', 'enterprise');

UPDATE plan_config SET custom_blocks = true
 WHERE tier IN ('growth', 'scale', 'enterprise');

UPDATE plan_config SET programmatic_pages = true
 WHERE tier IN ('scale', 'enterprise');

UPDATE plan_config SET multi_workspace = true
 WHERE tier IN ('scale', 'enterprise');
