import { pgTable, text, serial, timestamp, jsonb, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";

/**
 * Sales One-Pager Templates — custom templates created by admins in LP Studio.
 * Each row stores background URL, orientation, overlay fields (JSON), and
 * optional metadata.
 *
 * GLOBAL vs TENANT (mirrors sales_layout_defaults / generator_presets):
 *   • tenant_id NULL → a GLOBAL template (superadmin-authored) that every
 *     tenant sees read-only in its gallery and can duplicate into its own
 *     workspace for editing. Managed only via the superadmin routes.
 *   • tenant_id set  → that tenant's own template (full CRUD via the tenant
 *     routes, which scope every mutation to eq(tenantId) and therefore can
 *     never touch a global row).
 */
export const salesOnePagerTemplatesTable = pgTable("sales_one_pager_templates", {
  id: serial("id").primaryKey(),
  // NULL = global (superadmin-authored); set = tenant-owned.
  tenantId: integer("tenant_id").references(() => tenantsTable.id, { onDelete: "cascade" }),
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
