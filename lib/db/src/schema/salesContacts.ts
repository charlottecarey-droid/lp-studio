import { pgTable, text, serial, timestamp, jsonb, integer, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { salesAccountsTable } from "./salesAccounts";

/**
 * Sales Contacts — individual people at an account.
 */
export const salesContactsTable = pgTable("sales_contacts", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  salesforceId: text("salesforce_id"),  // SFDC Contact ID (003...) — unique PER TENANT (migration 0133)
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
  marketoLeadId: text("marketo_lead_id"),  // Marketo lead id — unique PER TENANT (migration 0134)
  marketoLastSyncedAt: timestamp("marketo_last_synced_at", { withTimezone: true }),
  hubspotContactId: text("hubspot_contact_id"),  // HubSpot contact id — unique PER TENANT (migration 0134)
  hubspotLastSyncedAt: timestamp("hubspot_last_synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("sales_contacts_tenant_status_idx").on(table.tenantId, table.status),
  index("sales_contacts_account_id_idx").on(table.accountId),
  // Per-TENANT Salesforce uniqueness (migration 0133). Was a global column
  // `.unique()`, which stopped two workspaces from holding the same Salesforce
  // record — see the migration for the full rationale.
  uniqueIndex("sales_contacts_tenant_salesforce_id_key")
    .on(table.tenantId, table.salesforceId)
    .where(sql`${table.salesforceId} IS NOT NULL`),
  // Same story for the Marketo/HubSpot ids (migration 0134). These matter to
  // the list importer, whose inserts are ON CONFLICT DO NOTHING: a global rule
  // turns a cross-workspace collision into a silently dropped row.
  uniqueIndex("sales_contacts_tenant_marketo_lead_id_key")
    .on(table.tenantId, table.marketoLeadId)
    .where(sql`${table.marketoLeadId} IS NOT NULL`),
  uniqueIndex("sales_contacts_tenant_hubspot_contact_id_key")
    .on(table.tenantId, table.hubspotContactId)
    .where(sql`${table.hubspotContactId} IS NOT NULL`),
]);

export const insertSalesContactSchema = createInsertSchema(salesContactsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSalesContact = z.infer<typeof insertSalesContactSchema>;
export type SalesContact = typeof salesContactsTable.$inferSelect;
