import { pgTable, text, serial, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Sales Accounts — the core entity for sales workflows.
 * Each account represents a target company/practice.
 */
export const salesAccountsTable = pgTable("sales_accounts", {
  id: serial("id").primaryKey(),
<<<<<<< HEAD
  salesforceId: text("salesforce_id").unique(),  // SFDC Account ID (001...)
=======
  sfdcId: text("sfdc_id"),                   // Salesforce Account ID (18-char) — unique key for SFDC sync
>>>>>>> 7652a239985921fda5c638e2aaacd8363b9025f6
  name: text("name").notNull(),
  domain: text("domain"),
  industry: text("industry"),
  segment: text("segment"),                  // e.g. "DSO", "DSO Practice", "Independent"
  parentAccountId: integer("parent_account_id"),  // for DSO → practice hierarchy
  status: text("status").notNull().default("prospect"),  // prospect | qualified | active | churned
  owner: text("owner"),                      // sales rep assigned
  abmTier: text("abm_tier"),                 // ABM Org Tier: Tier 1, Tier 2, Tier 3
  abmStage: text("abm_stage"),               // ABM Org Stage: Mapped, Engaged, Target, Opportunity, etc.
  practiceSegment: text("practice_segment"), // Practice Profile Segment: Enterprise, Large Enterprise, Small Multi-Location
  numLocations: integer("num_locations"),    // Number of practice locations
  msaSigned: text("msa_signed"),             // Enterprise MSA Signed: "0" or "1"
  enterprisePilot: text("enterprise_pilot"), // Enterprise Pilot: "0" or "1"
  dsoSize: text("dso_size"),                 // DSO Size: Small Multi-Location, Mid-Market 10-75 locations, Large 75+
  privateEquityFirm: text("private_equity_firm"), // PE firm backing the DSO
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zip: text("zip"),
  country: text("country"),
  notes: text("notes"),
  metadata: jsonb("metadata").default({}),   // flexible KV for custom fields
  sfdcLastSyncedAt: timestamp("sfdc_last_synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSalesAccountSchema = createInsertSchema(salesAccountsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSalesAccount = z.infer<typeof insertSalesAccountSchema>;
export type SalesAccount = typeof salesAccountsTable.$inferSelect;
