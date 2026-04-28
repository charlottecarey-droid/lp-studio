import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { lpTestsTable } from "./lpTests";
import { lpVariantsTable } from "./lpVariants";

// `test_id` / `variant_id` are nullable so we can record conversion events
// fired from a plain builder page (no A/B test running, no variant assigned).
// Before this, BlockForm/BlockEventPage hard-coded `testId: 0` which violated
// the FK and 500'd silently inside the browser try/catch — every funnel
// report missed those conversions. See lib/db/migrations/0006_lp_events_optional_test_variant.sql.
export const lpEventsTable = pgTable("lp_events", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  testId: integer("test_id").references(() => lpTestsTable.id, { onDelete: "cascade" }),
  variantId: integer("variant_id").references(() => lpVariantsTable.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  conversionType: text("conversion_type"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLpEventSchema = createInsertSchema(lpEventsTable).omit({ id: true, createdAt: true });
export type InsertLpEvent = z.infer<typeof insertLpEventSchema>;
export type LpEvent = typeof lpEventsTable.$inferSelect;
