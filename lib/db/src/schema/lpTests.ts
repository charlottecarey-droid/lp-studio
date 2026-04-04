import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const lpTestsTable = pgTable("lp_tests", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  status: text("status").notNull().default("draft"),
  testType: text("test_type").notNull().default("ab"),
  smartTrafficEnabled: boolean("smart_traffic_enabled").notNull().default(false),
  smartTrafficMinSamples: integer("smart_traffic_min_samples").notNull().default(100),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertLpTestSchema = createInsertSchema(lpTestsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLpTest = z.infer<typeof insertLpTestSchema>;
export type LpTest = typeof lpTestsTable.$inferSelect;
