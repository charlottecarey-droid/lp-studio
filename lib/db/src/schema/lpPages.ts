import { pgTable, text, serial, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const lpPagesTable = pgTable("lp_pages", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  blocks: jsonb("blocks").notNull().default([]),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertLpPageSchema = createInsertSchema(lpPagesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLpPage = z.infer<typeof insertLpPageSchema>;
export type LpPage = typeof lpPagesTable.$inferSelect;
