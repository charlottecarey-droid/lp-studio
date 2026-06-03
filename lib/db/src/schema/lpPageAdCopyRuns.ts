import { pgTable, serial, integer, jsonb, text, timestamp, index } from "drizzle-orm/pg-core";
import { lpPagesTable } from "./lpPages";
import { tenantsTable } from "./tenants";

export const lpPageAdCopyRunsTable = pgTable("lp_page_ad_copy_runs", {
  id: serial("id").primaryKey(),
  pageId: integer("page_id").notNull().references(() => lpPagesTable.id, { onDelete: "cascade" }),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  inputSummary: jsonb("input_summary").notNull().default({}),
  output: jsonb("output").notNull().default({}),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("lp_page_ad_copy_runs_page_idx").on(t.pageId),
  index("lp_page_ad_copy_runs_tenant_idx").on(t.tenantId),
]);

export type LpPageAdCopyRun = typeof lpPageAdCopyRunsTable.$inferSelect;
