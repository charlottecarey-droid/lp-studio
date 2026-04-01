import { pgTable, serial, jsonb, timestamp, integer } from "drizzle-orm/pg-core";

export const lpBrandSettingsTable = pgTable("lp_brand_settings", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().default(1),
  config: jsonb("config").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type LpBrandSettings = typeof lpBrandSettingsTable.$inferSelect;
