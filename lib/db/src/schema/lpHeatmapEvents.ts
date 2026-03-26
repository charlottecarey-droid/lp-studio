import { pgTable, text, serial, timestamp, integer, real } from "drizzle-orm/pg-core";
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
});

export type LpHeatmapEvent = typeof lpHeatmapEventsTable.$inferSelect;
