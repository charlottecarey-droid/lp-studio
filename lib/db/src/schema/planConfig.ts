import { pgTable, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

/**
 * Plan config — one row per canonical pricing tier
 * (free | starter | growth | scale | enterprise).
 *
 * Seeded from the canonical defaults in `@workspace/plan-config` and made
 * editable in SuperAdmin so tier display names, prices, caps, and feature
 * flags are configurable WITHOUT a code deploy. The backend reads this table
 * through a cached accessor (`artifacts/api-server/src/lib/planConfig.ts`)
 * and falls back to the canonical defaults when a row is missing or the DB
 * is unavailable.
 *
 * `null` numeric caps mean unlimited. `null` prices mean sales-only (the
 * enterprise tier).
 */
export const planConfigTable = pgTable("plan_config", {
  tier: text("tier").primaryKey(),
  displayName: text("display_name").notNull(),
  // Prices in whole USD. priceMonthly = month-to-month; priceAnnual =
  // month-equivalent when prepaid annually. null = sales-only.
  priceMonthly: integer("price_monthly"),
  priceAnnual: integer("price_annual"),
  selfServe: boolean("self_serve").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  // Feature flags
  salesConsole: boolean("sales_console").notNull().default(false),
  aiImageGen: boolean("ai_image_gen").notNull().default(false),
  customDomain: boolean("custom_domain").notNull().default(false),
  // Email sending tiers (Tier 2 / Tier 3). Default off; the resolver always
  // fails closed to the Tier 1 shared default sender when these are off or
  // the custom domain isn't verified.
  brandedEmailSubdomain: boolean("branded_email_subdomain").notNull().default(false),
  customEmailDomain: boolean("custom_email_domain").notNull().default(false),
  // July 2026 pricing-audit gates. Default off (fail closed); backfilled per
  // the canonical @workspace/plan-config defaults in migration 0115.
  smartTraffic: boolean("smart_traffic").notNull().default(false),
  customBlocks: boolean("custom_blocks").notNull().default(false),
  programmaticPages: boolean("programmatic_pages").notNull().default(false),
  multiWorkspace: boolean("multi_workspace").notNull().default(false),
  // Numeric caps — null = unlimited
  capPages: integer("cap_pages"),
  capForms: integer("cap_forms"),
  capUserSeats: integer("cap_user_seats"),
  capAiGenerationsPerMonth: integer("cap_ai_generations_per_month"),
  capHeatmapSessionsPerMonth: integer("cap_heatmap_sessions_per_month"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
