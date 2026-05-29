-- Phase 1 of the 5-tier pricing work
-- (docs/packaging/pricing-5-tier-implementation-plan.md).
--
-- SuperAdmin-configurable plan/pricing config. One row per canonical tier.
-- Seeded from the canonical defaults in @workspace/plan-config; the backend
-- reads this table through a cached accessor and falls back to those same
-- defaults when a row is missing. Editing a row in SuperAdmin changes caps /
-- prices / names live (within the cache TTL).
--
-- Idempotent: CREATE TABLE IF NOT EXISTS + INSERT ... ON CONFLICT DO NOTHING,
-- so re-running never clobbers SuperAdmin edits.

CREATE TABLE IF NOT EXISTS plan_config (
  tier                            text PRIMARY KEY,
  display_name                    text NOT NULL,
  price_monthly                   integer,
  price_annual                    integer,
  self_serve                      boolean NOT NULL DEFAULT true,
  sort_order                      integer NOT NULL DEFAULT 0,
  sales_console                   boolean NOT NULL DEFAULT false,
  ai_image_gen                    boolean NOT NULL DEFAULT false,
  custom_domain                   boolean NOT NULL DEFAULT false,
  cap_pages                       integer,
  cap_forms                       integer,
  cap_user_seats                  integer,
  cap_ai_generations_per_month    integer,
  cap_heatmap_sessions_per_month  integer,
  updated_at                      timestamptz NOT NULL DEFAULT now()
);

INSERT INTO plan_config
  (tier, display_name, price_monthly, price_annual, self_serve, sort_order,
   sales_console, ai_image_gen, custom_domain,
   cap_pages, cap_forms, cap_user_seats,
   cap_ai_generations_per_month, cap_heatmap_sessions_per_month)
VALUES
  ('free',       'Free',       0,    0,    true,  0, false, false, false, 1,    1,    1,    30,   1000),
  ('starter',    'Starter',    59,   49,   true,  1, false, false, true,  10,   5,    3,    200,  5000),
  ('growth',     'Growth',     249,  199,  true,  2, true,  false, true,  NULL, NULL, 10,   NULL, 25000),
  ('scale',      'Scale',      649,  499,  true,  3, true,  true,  true,  NULL, NULL, 25,   NULL, 100000),
  ('enterprise', 'Enterprise', NULL, NULL, false, 4, true,  true,  true,  NULL, NULL, NULL, NULL, NULL)
ON CONFLICT (tier) DO NOTHING;
