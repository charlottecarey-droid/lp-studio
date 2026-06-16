import { pgTable, serial, integer, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { lpPagesTable } from "./lpPages";

/**
 * Per-workspace "featured" templates.
 *
 * Records which templates a workspace has starred to feature for itself. A
 * featured template is surfaced prominently in the Template Marketplace
 * ("Featured" group) and offered as a starting point in the create-page modal.
 *
 * This is PER-TENANT curation, distinct from the platform's `premiumRank`
 * (a global ordering hint baked into the seed file) and from
 * `featured_homepage_templates` (the superadmin-managed marketing-homepage
 * list). Each workspace controls its own featured set with one star click.
 *
 * One row per (tenant, template) — the star toggle inserts the row and the
 * un-star deletes it. `template_id` FKs to `lp_pages.id` with ON DELETE CASCADE
 * so featured rows disappear automatically when a template page is deleted.
 * Templates a tenant may feature are the ones visible to it: its own templates
 * or any global template.
 */
export const lpTenantFeaturedTemplatesTable = pgTable("lp_tenant_featured_templates", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  templateId: integer("template_id")
    .notNull()
    .references(() => lpPagesTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  // One row per (tenant, template); the star toggle upserts/deletes on this.
  uniqueIndex("lp_tenant_featured_templates_tenant_template_idx").on(t.tenantId, t.templateId),
  // Fast lookup of a tenant's featured set when enriching the library.
  index("lp_tenant_featured_templates_tenant_idx").on(t.tenantId),
]);

export type LpTenantFeaturedTemplate = typeof lpTenantFeaturedTemplatesTable.$inferSelect;
export type InsertLpTenantFeaturedTemplate = typeof lpTenantFeaturedTemplatesTable.$inferInsert;
