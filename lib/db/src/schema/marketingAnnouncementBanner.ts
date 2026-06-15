import { pgTable, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";

/**
 * Marketing homepage announcement banner — a single, superadmin-editable slim
 * bar shown at the very top of the marketing apex homepage (lpstudio.ai/).
 *
 * Lets the team promote something (a guide, a launch, an event) with a short
 * message + a link, toggled on/off without a code edit or redeploy. It mirrors
 * the `marketing_homepage_og` pattern:
 *
 *  - Single-row table (`id` fixed at 1) — there is exactly one homepage banner.
 *  - The marketing site reads the row from a public endpoint and only renders
 *    the bar when `enabled` is true and the text + link are non-empty; it falls
 *    back to "no banner" otherwise, so a half-filled config never ships a broken
 *    bar.
 *  - The build-time marketing prerender also reads this row (best-effort) so the
 *    bar is baked into the static HTML and doesn't flash in after hydration.
 */
export const marketingAnnouncementBannerTable = pgTable("marketing_announcement_banner", {
  id: integer("id").primaryKey().default(1),
  enabled: boolean("enabled").notNull().default(false),
  text: text("text").notNull().default(""),
  linkUrl: text("link_url").notNull().default(""),
  ctaLabel: text("cta_label").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
