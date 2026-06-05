import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

/**
 * Featured homepage templates — the ordered list of template cards shown in
 * the marketing homepage "templates" section (TemplatesEmbed).
 *
 * Previously this list was a hardcoded `TEMPLATES` array inside the marketing
 * component, so changing which templates were featured (or how they were
 * presented) required a code edit + redeploy. This table moves the list into
 * superadmin-editable config:
 *
 *  - `templateId` is the underlying LP_TEMPLATES id that drives the live
 *    /preview/template/:id iframe and the "Use this template" clone handoff.
 *    The superadmin picks from real, usable LP_TEMPLATES ids so every
 *    featured card actually previews and clones.
 *  - `title` / `description` / `thumbnailUrl` / `category` / `blocksCount`
 *    are the displayed attributes, editable independently of the underlying
 *    template's own metadata.
 *  - `enabled` toggles visibility on the homepage without deleting the row.
 *  - `sortOrder` controls the left-to-right card order.
 *
 * The public marketing site reads the enabled, ordered rows from a public,
 * CORS-enabled endpoint and falls back to its built-in array when the table
 * is empty or the fetch fails, so the section is never blank.
 */
export const featuredTemplatesTable = pgTable("featured_homepage_templates", {
  id: serial("id").primaryKey(),
  templateId: text("template_id").notNull(),
  title: text("title").notNull().default(""),
  description: text("description").notNull().default(""),
  thumbnailUrl: text("thumbnail_url").notNull().default(""),
  category: text("category").notNull().default(""),
  blocksCount: integer("blocks_count").notNull().default(0),
  enabled: boolean("enabled").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
