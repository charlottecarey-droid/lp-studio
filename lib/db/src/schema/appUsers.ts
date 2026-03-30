import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * App Users — human accounts that can log in to LP Studio or the DSO admin.
 *
 * Roles:
 *   superadmin — Dandy-internal; can see/manage all tenants
 *   admin       — tenant admin; full access within their tenant
 *   rep         — sales rep; read access + own lead actions within their tenant
 *   viewer      — read-only within their tenant
 *
 * tenantId is NULL for superadmins (they belong to no single tenant).
 * googleId is the `sub` claim from Google OAuth — unique per Google account.
 */
export const appUsersTable = pgTable("app_users", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id"),
  googleId: text("google_id").unique(),
  email: text("email").notNull().unique(),
  name: text("name").notNull().default(""),
  avatarUrl: text("avatar_url"),
  role: text("role").notNull().default("rep"),
  status: text("status").notNull().default("active"),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAppUserSchema = createInsertSchema(appUsersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAppUser = z.infer<typeof insertAppUserSchema>;
export type AppUser = typeof appUsersTable.$inferSelect;
