import { pgTable, text, serial, timestamp, jsonb, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Sales One-Pager Templates — custom templates created by admins in LP Studio.
 * Each row belongs to a tenant and stores background URL, orientation,
 * overlay fields (JSON), and optional metadata.
 */
export const salesOnePagerTemplatesTable = pgTable("sales_one_pager_templates", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  name: text("name").notNull(),
  backgroundUrl: text("background_url").notNull().default(""),
  orientation: text("orientation").notNull().default("portrait"),
  fields: jsonb("fields").notNull().default([]),
  headerHeight: integer("header_height").notNull().default(30),
  headerImageUrl: text("header_image_url"),
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSalesOnePagerTemplateSchema = createInsertSchema(salesOnePagerTemplatesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSalesOnePagerTemplate = z.infer<typeof insertSalesOnePagerTemplateSchema>;
export type SalesOnePagerTemplate = typeof salesOnePagerTemplatesTable.$inferSelect;
