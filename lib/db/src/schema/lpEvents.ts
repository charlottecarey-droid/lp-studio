import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { lpTestsTable } from "./lpTests";
import { lpVariantsTable } from "./lpVariants";

export const lpEventsTable = pgTable("lp_events", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  testId: integer("test_id").notNull().references(() => lpTestsTable.id, { onDelete: "cascade" }),
  variantId: integer("variant_id").notNull().references(() => lpVariantsTable.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  conversionType: text("conversion_type"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLpEventSchema = createInsertSchema(lpEventsTable).omit({ id: true, createdAt: true });
export type InsertLpEvent = z.infer<typeof insertLpEventSchema>;
export type LpEvent = typeof lpEventsTable.$inferSelect;
