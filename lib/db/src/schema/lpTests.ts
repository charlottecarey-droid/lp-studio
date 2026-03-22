import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const lpTestsTable = pgTable("lp_tests", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  status: text("status").notNull().default("draft"),
  testType: text("test_type").notNull().default("ab"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertLpTestSchema = createInsertSchema(lpTestsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLpTest = z.infer<typeof insertLpTestSchema>;
export type LpTest = typeof lpTestsTable.$inferSelect;
