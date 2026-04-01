import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const PERMISSION_KEYS = [
  "pages",
  "tests",
  "analytics",
  "forms_leads",
  "brand",
  "blocks",
  "sales_dashboard",
  "sales_contacts",
  "sales_accounts",
  "sales_outreach",
  "sales_signals",
  "settings",
  "team",
  "roles",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];
export type Permissions = Partial<Record<PermissionKey, boolean>>;

export const tenantRolesTable = pgTable("tenant_roles", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  permissions: jsonb("permissions").notNull().$type<Permissions>().default({}),
  isAdmin: boolean("is_admin").notNull().default(false),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTenantRoleSchema = createInsertSchema(tenantRolesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTenantRole = z.infer<typeof insertTenantRoleSchema>;
export type TenantRole = typeof tenantRolesTable.$inferSelect;
