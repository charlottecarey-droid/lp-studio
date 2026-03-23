import { pgTable, text, serial, timestamp, integer, boolean, real, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { lpTestsTable } from "./lpTests";
import { lpPagesTable } from "./lpPages";

export const lpVariantsTable = pgTable("lp_variants", {
  id: serial("id").primaryKey(),
  testId: integer("test_id").notNull().references(() => lpTestsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  isControl: boolean("is_control").notNull().default(false),
  trafficWeight: real("traffic_weight").notNull().default(50),
  config: jsonb("config").notNull().default({}),
  builderPageId: integer("builder_page_id").references(() => lpPagesTable.id, { onDelete: "set null" }),
  testedBlockId: text("tested_block_id"),
  blockOverrides: jsonb("block_overrides").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLpVariantSchema = createInsertSchema(lpVariantsTable).omit({ id: true, createdAt: true });
export type InsertLpVariant = z.infer<typeof insertLpVariantSchema>;
export type LpVariant = typeof lpVariantsTable.$inferSelect;
