import { pgTable, text, serial, timestamp, jsonb, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { isNull } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Sales Layout Defaults — key-value config storage for one-pager templates,
 * template visibility, and other layout settings. Each (tenant, key) pair
 * is unique so upserts replace existing values.
 *
 * GLOBAL vs TENANT (mirrors the generator_presets model):
 *   • tenant_id NULL → a GLOBAL default (superadmin-managed) every tenant
 *     inherits when it has no row of its own for that key.
 *   • tenant_id set  → that tenant's own value; it fully overrides the global
 *     row for the same key (whole-row precedence, no field-level merge).
 * Dandy-gated keys (isDandyGatedLayoutKey) never fall back to a global row for
 * non-Dandy tenants — the read routes enforce this.
 */
export const salesLayoutDefaultsTable = pgTable("sales_layout_defaults", {
  id: serial("id").primaryKey(),
  // NULL = global default; set = tenant-specific value.
  tenantId: integer("tenant_id"),
  templateKey: text("template_key").notNull(),
  config: jsonb("config").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("sales_layout_defaults_tenant_key_idx").on(table.tenantId, table.templateKey),
  // Postgres treats NULLs as distinct in the composite index above, so global
  // rows need their own uniqueness guarantee (one global row per key).
  uniqueIndex("sales_layout_defaults_global_key_idx").on(table.templateKey).where(isNull(table.tenantId)),
]);

export const insertSalesLayoutDefaultSchema = createInsertSchema(salesLayoutDefaultsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSalesLayoutDefault = z.infer<typeof insertSalesLayoutDefaultSchema>;
export type SalesLayoutDefault = typeof salesLayoutDefaultsTable.$inferSelect;
