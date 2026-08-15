import { pgTable, text, serial, timestamp, integer, index } from "drizzle-orm/pg-core";
import { lpPagesTable } from "./lpPages";
import { salesHotlinksTable } from "./salesHotlinks";

export const lpPageVisitsTable = pgTable("lp_page_visits", {
  id: serial("id").primaryKey(),
  pageId: integer("page_id").notNull().references(() => lpPagesTable.id, { onDelete: "cascade" }),
  sessionId: text("session_id").notNull(),
  city: text("city"),
  region: text("region"),
  country: text("country"),
  countryCode: text("country_code"),
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  utmTerm: text("utm_term"),
  utmContent: text("utm_content"),
  // Accumulated tab-visible seconds for this session's time on the page,
  // MAX-merged from the viewer's dwell beacon (capped at 30 min). NULL =
  // visit predates dwell tracking — render "—", never 0.
  dwellSeconds: integer("dwell_seconds"),
  // Sales hotlink this session arrived through (?hl=<token>), stamped by the
  // dwell beacon after the server re-validates the token against page_id.
  // NULL = organic/anonymous visit (or predates hotlink attribution). Lets
  // the visits feed resolve hotlink→contact identity per session.
  hotlinkId: integer("hotlink_id").references(() => salesHotlinksTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("lp_page_visits_page_id_idx").on(table.pageId),
  index("lp_page_visits_hotlink_id_idx").on(table.hotlinkId),
  // Composite index supporting windowed, page-scoped analytics aggregations
  // (per-page detail view, Task #719). See migration 0061_page_detail_indexes.sql.
  index("lp_page_visits_page_id_created_at_idx").on(table.pageId, table.createdAt),
]);

export type LpPageVisit = typeof lpPageVisitsTable.$inferSelect;
