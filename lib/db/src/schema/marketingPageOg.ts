import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

/**
 * Marketing page share cards (Open Graph) — superadmin-editable OG
 * title/description/image for the marketing site's secondary routes
 * (lpstudio.ai/features, /pricing, /for-marketing, /for-sales, /compare) used
 * when those links are shared on Slack / iMessage / LinkedIn / etc.
 *
 * This generalises the single-row `marketing_homepage_og` table (Task #970) to
 * the rest of the key marketing routes (Task #997). Rows are keyed by a stable
 * `page_key` (e.g. "features"). The homepage keeps its own dedicated single-row
 * table — only the additional routes live here.
 *
 *  - Each marketing route reads its row from a public endpoint and falls back,
 *    field by field, to its built-in defaults (the values previously hardcoded
 *    in each page's `usePageMeta({...})`) when a value is empty or the fetch
 *    fails, so the share card is never blank.
 *  - The build-time marketing prerender also reads these rows (best-effort) so
 *    the OG tags baked into the static HTML that non-JS social scrapers fetch
 *    reflect the superadmin's edits.
 *  - Unlike the homepage table, this one is NOT seeded — an absent row simply
 *    means "use the page's built-in defaults".
 */
export const marketingPageOgTable = pgTable("marketing_page_og", {
  pageKey: text("page_key").primaryKey(),
  ogTitle: text("og_title").notNull().default(""),
  ogDescription: text("og_description").notNull().default(""),
  ogImageUrl: text("og_image_url").notNull().default(""),
  ogImageWidth: integer("og_image_width"),
  ogImageHeight: integer("og_image_height"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
