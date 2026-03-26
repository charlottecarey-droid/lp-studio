import { pgTable, text, serial, timestamp, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { lpTestsTable } from "./lpTests";
import { lpVariantsTable } from "./lpVariants";

export const lpSmartTrafficStatsTable = pgTable("lp_smart_traffic_stats", {
  id: serial("id").primaryKey(),
  testId: integer("test_id").notNull().references(() => lpTestsTable.id, { onDelete: "cascade" }),
  variantId: integer("variant_id").notNull().references(() => lpVariantsTable.id, { onDelete: "cascade" }),
  featureBucket: text("feature_bucket").notNull().default("global"),
  successes: integer("successes").notNull().default(0),
  failures: integer("failures").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("smart_traffic_stats_unique").on(table.testId, table.variantId, table.featureBucket),
]);

export const insertLpSmartTrafficStatsSchema = createInsertSchema(lpSmartTrafficStatsTable).omit({ id: true, updatedAt: true });
export type InsertLpSmartTrafficStats = z.infer<typeof insertLpSmartTrafficStatsSchema>;
export type LpSmartTrafficStats = typeof lpSmartTrafficStatsTable.$inferSelect;
