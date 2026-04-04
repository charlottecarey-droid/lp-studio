import { pgTable, text, serial, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { salesAccountsTable } from "./salesAccounts";

/**
 * Sales Contacts — individual people at an account.
 */
export const salesContactsTable = pgTable("sales_contacts", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  salesforceId: text("salesforce_id").unique(),  // SFDC Contact ID (003...)
  accountId: integer("account_id").notNull().references(() => salesAccountsTable.id, { onDelete: "cascade" }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  title: text("title"),                  // job title
  role: text("role"),                    // buyer persona: CEO, CDO, VP Ops, etc.
  phone: text("phone"),
  tier: text("tier"),                    // ABM contact tier: ENT, IW, LENT
  titleLevel: text("title_level"),       // seniority: C Suite, VP Level, Director Level, etc.
  contactRole: text("contact_role"),     // functional role: CEO / President, COO / VP of Operations, etc.
  department: text("department"),        // C Suite, Operations, Finance, Sales and Marketing, etc.
  linkedinUrl: text("linkedin_url"),     // LinkedIn profile URL
  status: text("status").notNull().default("active"), // active | unsubscribed | bounced
  metadata: jsonb("metadata").default({}),
  sfdcLastSyncedAt: timestamp("sfdc_last_synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSalesContactSchema = createInsertSchema(salesContactsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSalesContact = z.infer<typeof insertSalesContactSchema>;
export type SalesContact = typeof salesContactsTable.$inferSelect;
