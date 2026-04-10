import { pgTable, text, serial, timestamp, jsonb, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { salesAccountsTable } from "./salesAccounts";
import { tenantsTable } from "./tenants";

/**
 * SFDC Connection — stores OAuth credentials and sync state for Salesforce.
 * One row per (tenant, org) pair — each tenant can connect their own Salesforce org.
 */
export const sfdcConnectionsTable = pgTable("sfdc_connections", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenantsTable.id, { onDelete: "cascade" }),
  instanceUrl: text("instance_url").notNull(),        // e.g. https://na1.salesforce.com
  orgId: text("org_id").notNull(),                    // Salesforce org ID (018...)
  accessToken: text("access_token").notNull(),         // encrypted at rest
  refreshToken: text("refresh_token").notNull(),       // encrypted at rest
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
  status: text("status").notNull().default("connected"),  // connected | disconnected | error
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  lastSyncError: text("last_sync_error"),
  syncEnabled: boolean("sync_enabled").notNull().default(true),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSfdcConnectionSchema = createInsertSchema(sfdcConnectionsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertSfdcConnection = z.infer<typeof insertSfdcConnectionSchema>;
export type SfdcConnection = typeof sfdcConnectionsTable.$inferSelect;

/**
 * SFDC Field Mappings — configurable field mapping between SFDC objects and LP Studio tables.
 * Allows users to customize which SFDC fields map to which local fields.
 */
export const sfdcFieldMappingsTable = pgTable("sfdc_field_mappings", {
  id: serial("id").primaryKey(),
  connectionId: integer("connection_id").notNull().references(() => sfdcConnectionsTable.id, { onDelete: "cascade" }),
  sfdcObject: text("sfdc_object").notNull(),           // Account | Contact | Lead | Opportunity
  sfdcField: text("sfdc_field").notNull(),             // e.g. "Name", "BillingCity", "Email"
  localTable: text("local_table").notNull(),           // sales_accounts | sales_contacts
  localField: text("local_field").notNull(),           // e.g. "name", "domain", "email"
  isActive: boolean("is_active").notNull().default(true),
  transformFn: text("transform_fn"),                   // optional JS transform expression
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSfdcFieldMappingSchema = createInsertSchema(sfdcFieldMappingsTable).omit({
  id: true, createdAt: true,
});
export type InsertSfdcFieldMapping = z.infer<typeof insertSfdcFieldMappingSchema>;
export type SfdcFieldMapping = typeof sfdcFieldMappingsTable.$inferSelect;

/**
 * SFDC Sync Log — audit trail for each sync operation.
 */
export const sfdcSyncLogTable = pgTable("sfdc_sync_log", {
  id: serial("id").primaryKey(),
  connectionId: integer("connection_id").notNull().references(() => sfdcConnectionsTable.id, { onDelete: "cascade" }),
  syncType: text("sync_type").notNull(),               // full | incremental | manual
  sfdcObject: text("sfdc_object").notNull(),           // Account | Contact | Lead | Opportunity
  recordsProcessed: integer("records_processed").default(0),
  recordsCreated: integer("records_created").default(0),
  recordsUpdated: integer("records_updated").default(0),
  recordsSkipped: integer("records_skipped").default(0),
  status: text("status").notNull().default("running"), // running | completed | failed
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export type SfdcSyncLog = typeof sfdcSyncLogTable.$inferSelect;

/**
 * SFDC Leads — Salesforce Leads synced into LP Studio.
 * Leads are separate from Contacts in SFDC; they represent unqualified prospects.
 */
export const sfdcLeadsTable = pgTable("sfdc_leads", {
  id: serial("id").primaryKey(),
  salesforceId: text("salesforce_id").notNull().unique(),
  firstName: text("first_name"),
  lastName: text("last_name").notNull(),
  email: text("email"),
  company: text("company"),
  title: text("title"),
  phone: text("phone"),
  status: text("status"),                              // Open, Working, Closed, etc.
  leadSource: text("lead_source"),
  industry: text("industry"),
  rating: text("rating"),                              // Hot, Warm, Cold
  convertedAccountId: integer("converted_account_id"), // link to sales_accounts if converted
  convertedContactId: integer("converted_contact_id"), // link to sales_contacts if converted
  metadata: jsonb("metadata").default({}),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type SfdcLead = typeof sfdcLeadsTable.$inferSelect;

/**
 * SFDC Opportunities — pipeline visibility from Salesforce.
 */
export const sfdcOpportunitiesTable = pgTable("sfdc_opportunities", {
  id: serial("id").primaryKey(),
  salesforceId: text("salesforce_id").notNull().unique(),
  accountId: integer("account_id").references(() => salesAccountsTable.id),
  name: text("name").notNull(),
  amount: text("amount"),                              // stored as text to avoid precision issues
  stageName: text("stage_name"),                       // Prospecting, Negotiation, Closed Won, etc.
  probability: integer("probability"),                 // 0-100
  closeDate: timestamp("close_date", { withTimezone: true }),
  type: text("type"),                                  // New Business, Existing Business
  ownerId: text("owner_id"),
  ownerName: text("owner_name"),
  isClosed: boolean("is_closed").default(false),
  isWon: boolean("is_won").default(false),
  metadata: jsonb("metadata").default({}),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type SfdcOpportunity = typeof sfdcOpportunitiesTable.$inferSelect;
