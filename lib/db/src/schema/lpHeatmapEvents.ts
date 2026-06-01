import { pgTable, text, serial, timestamp, integer, real, index } from "drizzle-orm/pg-core";
import { lpPagesTable } from "./lpPages";

export const lpHeatmapEventsTable = pgTable("lp_heatmap_events", {
  id: serial("id").primaryKey(),
  pageId: integer("page_id").notNull().references(() => lpPagesTable.id, { onDelete: "cascade" }),
  sessionId: text("session_id").notNull(),
  eventType: text("event_type").notNull(), // "click" | "scroll"
  // Click data — coordinates as percentages (0-100) of viewport width/height
  xPct: real("x_pct"),
  yPct: real("y_pct"),
  // Which block was clicked (block id from the blocks array)
  blockId: text("block_id"),
  elementTag: text("element_tag"), // "button", "a", "img", etc.
  // Scroll data — max scroll depth as percentage of total page height
  scrollDepthPct: real("scroll_depth_pct"),
  // Viewport dimensions at time of event (for responsive normalization)
  viewportWidth: integer("viewport_width"),
  viewportHeight: integer("viewport_height"),
  // Device type for filtering
  device: text("device"), // "desktop" | "tablet" | "mobile"
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  // Composite index for per-session engagement enrichment on the per-page
  // detail view (Task #719). See migration 0061_page_detail_indexes.sql.
  index("lp_heatmap_events_page_id_session_id_idx").on(table.pageId, table.sessionId),
]);

export type LpHeatmapEvent = typeof lpHeatmapEventsTable.$inferSelect;
