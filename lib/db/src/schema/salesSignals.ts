import { pgTable, text, serial, timestamp, jsonb, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { salesAccountsTable } from "./salesAccounts";

/**
 * Sales Signals — real-time engagement events (page views, email opens, clicks, form fills).
 * Powers the Signals feed in the Sales Console.
 */
export const salesSignalsTable = pgTable("sales_signals", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  accountId: integer("account_id").references(() => salesAccountsTable.id, { onDelete: "cascade" }),
  contactId: integer("contact_id"),
  hotlinkId: integer("hotlink_id"),
  type: text("type").notNull(),            // page_view | email_open | email_click | form_submit | link_click
  source: text("source"),                  // which page or email triggered this
  metadata: jsonb("metadata").default({}), // flexible event payload
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("sales_signals_tenant_created_idx").on(table.tenantId, table.createdAt),
  index("sales_signals_account_id_idx").on(table.accountId),
]);

export const insertSalesSignalSchema = createInsertSchema(salesSignalsTable).omit({ id: true, createdAt: true });
export type InsertSalesSignal = z.infer<typeof insertSalesSignalSchema>;
export type SalesSignal = typeof salesSignalsTable.$inferSelect;
