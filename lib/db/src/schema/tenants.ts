import { pgTable, text, serial, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Tenants — one row per customer organisation.
 * Dandy will be tenant #1. Every other future customer gets their own row.
 * All data (pages, contacts, leads, etc.) will eventually carry a tenant_id FK
 * pointing here. That migration happens when multi-tenancy is activated;
 * for now this table establishes the identity anchor.
 */
export const tenantsTable = pgTable("tenants", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  domain: text("domain"),
  micrositeDomain: text("microsite_domain"),
  plan: text("plan").notNull().default("trial"),
  status: text("status").notNull().default("active"),
  settings: jsonb("settings").default({}),
  // Legacy column kept for compatibility — currently unused (all rows are {}).
  metadata: jsonb("metadata").default({}),
  onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
  // When set, this tenant's image library also includes uploads from the linked
  // tenant (and vice versa, when the link is reciprocal). Used to let sibling
  // brands like Dandy and Dandy SMB share one media catalog. Keep this minimal
  // — it is not a general parent/child tenant relationship.
  sharesLibraryWithTenantId: integer("shares_library_with_tenant_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTenantSchema = createInsertSchema(tenantsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Tenant = typeof tenantsTable.$inferSelect;
