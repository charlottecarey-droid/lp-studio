import { pgTable, text, serial, timestamp, integer, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Sales Events — a conference/summit whose session catalog is entered once
 * and reused to assemble per-account agendas (sales_event_agendas).
 */
export const salesEventsTable = pgTable("sales_events", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  name: text("name").notNull(),
  location: text("location"),                // "Austin, TX"
  startDate: date("start_date"),
  endDate: date("end_date"),
  sourceUrl: text("source_url"),             // public agenda page the catalog was imported from, if any
  description: text("description"),
  status: text("status").notNull().default("draft"), // draft | active | archived
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSalesEventSchema = createInsertSchema(salesEventsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSalesEvent = z.infer<typeof insertSalesEventSchema>;
export type SalesEvent = typeof salesEventsTable.$inferSelect;
