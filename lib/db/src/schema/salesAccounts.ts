import { pgTable, text, serial, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Sales Accounts — the core entity for sales workflows.
 * Each account represents a target company/practice.
 */
export const salesAccountsTable = pgTable("sales_accounts", {
  id: serial("id").primaryKey(),
  sfdcId: text("sfdc_id"),                   // Salesforce Account ID (18-char) — unique key for SFDC sync
  name: text("name").notNull(),
  domain: text("domain"),
  industry: text("industry"),
  segment: text("segment"),                  // e.g. "DSO", "DSO Practice", "Independent"
  parentAccountId: integer("parent_account_id"),  // for DSO → practice hierarchy
  status: text("status").notNull().default("prospect"),  // prospect | qualified | active | churned
  owner: text("owner"),                      // sales rep assigned
  notes: text("notes"),
  metadata: jsonb("metadata").default({}),   // flexible KV for custom fields
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSalesAccountSchema = createInsertSchema(salesAccountsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSalesAccount = z.infer<typeof insertSalesAccountSchema>;
export type SalesAccount = typeof salesAccountsTable.$inferSelect;
