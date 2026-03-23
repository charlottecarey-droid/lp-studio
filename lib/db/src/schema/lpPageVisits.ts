import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { lpPagesTable } from "./lpPages";

export const lpPageVisitsTable = pgTable("lp_page_visits", {
  id: serial("id").primaryKey(),
  pageId: integer("page_id").notNull().references(() => lpPagesTable.id, { onDelete: "cascade" }),
  sessionId: text("session_id").notNull(),
  city: text("city"),
  region: text("region"),
  country: text("country"),
  countryCode: text("country_code"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LpPageVisit = typeof lpPageVisitsTable.$inferSelect;
