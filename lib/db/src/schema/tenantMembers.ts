import { pgTable, text, serial, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";
import { appUsersTable } from "./appUsers";
import { tenantRolesTable } from "./tenantRoles";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tenantMembersTable = pgTable("tenant_members", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => appUsersTable.id, { onDelete: "cascade" }),
  roleId: integer("role_id").notNull().references(() => tenantRolesTable.id),
  email: text("email"),
  invitedAt: timestamp("invited_at", { withTimezone: true }).notNull().defaultNow(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
}, (t) => [
  unique("tenant_members_tenant_user_unique").on(t.tenantId, t.userId),
]);

export const insertTenantMemberSchema = createInsertSchema(tenantMembersTable).omit({ id: true, invitedAt: true });
export type InsertTenantMember = z.infer<typeof insertTenantMemberSchema>;
export type TenantMember = typeof tenantMembersTable.$inferSelect;
