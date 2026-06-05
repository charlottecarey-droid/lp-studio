import { pgTable, integer, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Marketing homepage share card (Open Graph) — the single, superadmin-editable
 * OG title/description/image used by the marketing site's apex homepage
 * (lpstudio.ai/) when its link is shared on Slack / iMessage / LinkedIn / etc.
 *
 * Previously these values were hardcoded constants inside the marketing
 * `home.tsx` (`usePageMeta({...})`), so changing how the homepage rendered
 * when shared required a code edit + redeploy and gave the team no live
 * preview or length guidance. This table moves them into superadmin-editable
 * config, mirroring `featured_homepage_templates`:
 *
 *  - It is a single-row table (`id` fixed at 1) — there is exactly one
 *    marketing homepage.
 *  - The marketing site reads the row from a public endpoint and falls back,
 *    field by field, to its built-in defaults when a value is empty or the
 *    fetch fails, so the homepage share card is never blank.
 *  - The build-time marketing prerender also reads this row (best-effort) so
 *    the OG tags baked into the static HTML that non-JS social scrapers fetch
 *    reflect the superadmin's edits.
 */
export const marketingHomepageOgTable = pgTable("marketing_homepage_og", {
  id: integer("id").primaryKey().default(1),
  ogTitle: text("og_title").notNull().default(""),
  ogDescription: text("og_description").notNull().default(""),
  ogImageUrl: text("og_image_url").notNull().default(""),
  ogImageWidth: integer("og_image_width"),
  ogImageHeight: integer("og_image_height"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
