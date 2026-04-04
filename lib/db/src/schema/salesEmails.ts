import { pgTable, text, serial, timestamp, jsonb, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { salesAccountsTable } from "./salesAccounts";
import { salesContactsTable } from "./salesContacts";
import { salesHotlinksTable } from "./salesHotlinks";

/**
 * Sales Email Templates — reusable email templates with merge variables.
 */
export const salesEmailTemplatesTable = pgTable("sales_email_templates", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  bodyHtml: text("body_html").notNull(),
  bodyText: text("body_text"),
  mergeVars: jsonb("merge_vars").default([]),   // list of {{var}} names used
  category: text("category").default("general"), // general | follow-up | intro | case-study
  format: text("format").notNull().default("plain"), // plain | styled
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSalesEmailTemplateSchema = createInsertSchema(salesEmailTemplatesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSalesEmailTemplate = z.infer<typeof insertSalesEmailTemplateSchema>;
export type SalesEmailTemplate = typeof salesEmailTemplatesTable.$inferSelect;

/**
 * Sales Email Campaigns — a campaign sends a template to a list of contacts.
 */
export const salesEmailCampaignsTable = pgTable("sales_email_campaigns", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  name: text("name").notNull(),
  templateId: integer("template_id").notNull().references(() => salesEmailTemplatesTable.id),
  accountId: integer("account_id").references(() => salesAccountsTable.id),
  status: text("status").notNull().default("draft"),  // draft | scheduled | sending | sent | paused
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  recipientCount: integer("recipient_count").default(0),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSalesEmailCampaignSchema = createInsertSchema(salesEmailCampaignsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSalesEmailCampaign = z.infer<typeof insertSalesEmailCampaignSchema>;
export type SalesEmailCampaign = typeof salesEmailCampaignsTable.$inferSelect;

/**
 * Sales Email Sends — individual send records per contact per campaign.
 */
export const salesEmailSendsTable = pgTable("sales_email_sends", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").references(() => salesEmailCampaignsTable.id, { onDelete: "cascade" }),
  contactId: integer("contact_id").notNull().references(() => salesContactsTable.id, { onDelete: "cascade" }),
  hotlinkId: integer("hotlink_id").references(() => salesHotlinksTable.id, { onDelete: "set null" }),
  email: text("email").notNull(),
  status: text("status").notNull().default("queued"), // queued | sent | delivered | opened | clicked | bounced | failed
  sentAt: timestamp("sent_at", { withTimezone: true }),
  openedAt: timestamp("opened_at", { withTimezone: true }),
  clickedAt: timestamp("clicked_at", { withTimezone: true }),
  bouncedAt: timestamp("bounced_at", { withTimezone: true }),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSalesEmailSendSchema = createInsertSchema(salesEmailSendsTable).omit({ id: true, createdAt: true });
export type InsertSalesEmailSend = z.infer<typeof insertSalesEmailSendSchema>;
export type SalesEmailSend = typeof salesEmailSendsTable.$inferSelect;
