import { pgTable, serial, integer, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { lpPagesTable } from "./lpPages";

/**
 * Per-workspace template usage tracking (task #753).
 *
 * Records, per (tenant, template), when someone in the workspace last cloned
 * ("used") that template. Drives the "Recently Used" sort in both the
 * Marketing and Sales template libraries: templates the workspace has cloned
 * most recently sort first; templates it has never used (no row here) sort
 * last.
 *
 * One row per (tenant, template) — each clone upserts the row and bumps
 * `last_used_at`. The write is best-effort on the clone path: it must never
 * block or fail a clone. `template_id` FKs to `lp_pages.id` with ON DELETE
 * CASCADE so usage rows disappear when a template page is deleted.
 */
export const lpTemplateUsageTable = pgTable("lp_template_usage", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  templateId: integer("template_id")
    .notNull()
    .references(() => lpPagesTable.id, { onDelete: "cascade" }),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  // One row per (tenant, template); each use upserts on this constraint.
  uniqueIndex("lp_template_usage_tenant_template_idx").on(t.tenantId, t.templateId),
  // Fast lookup of a tenant's usage timestamps when enriching the library.
  index("lp_template_usage_tenant_idx").on(t.tenantId),
]);

export type LpTemplateUsage = typeof lpTemplateUsageTable.$inferSelect;
export type InsertLpTemplateUsage = typeof lpTemplateUsageTable.$inferInsert;
