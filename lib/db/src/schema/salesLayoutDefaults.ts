import { pgTable, text, serial, timestamp, jsonb, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Sales Layout Defaults — key-value config storage for one-pager templates,
 * template visibility, and other layout settings. Each (tenant, key) pair
 * is unique so upserts replace existing values.
 */
export const salesLayoutDefaultsTable = pgTable("sales_layout_defaults", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  templateKey: text("template_key").notNull(),
  config: jsonb("config").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("sales_layout_defaults_tenant_key_idx").on(table.tenantId, table.templateKey),
]);

export const insertSalesLayoutDefaultSchema = createInsertSchema(salesLayoutDefaultsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSalesLayoutDefault = z.infer<typeof insertSalesLayoutDefaultSchema>;
export type SalesLayoutDefault = typeof salesLayoutDefaultsTable.$inferSelect;
