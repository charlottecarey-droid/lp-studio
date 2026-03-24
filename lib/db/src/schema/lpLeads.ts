import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { lpPagesTable } from "./lpPages";

export const lpLeadsTable = pgTable("lp_leads", {
  id: serial("id").primaryKey(),
  pageId: integer("page_id").notNull().references(() => lpPagesTable.id, { onDelete: "cascade" }),
  variantId: integer("variant_id"),
  fields: jsonb("fields").notNull().default({}),
  ip: text("ip"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLpLeadSchema = createInsertSchema(lpLeadsTable).omit({ id: true, createdAt: true });
export type InsertLpLead = z.infer<typeof insertLpLeadSchema>;
export type LpLead = typeof lpLeadsTable.$inferSelect;

export const lpFormNotificationsTable = pgTable("lp_form_notifications", {
  id: serial("id").primaryKey(),
  pageId: integer("page_id").notNull().references(() => lpPagesTable.id, { onDelete: "cascade" }).unique(),
  emailRecipients: jsonb("email_recipients").notNull().default([]),
  webhookUrl: text("webhook_url"),
  marketoConfig: jsonb("marketo_config"),
  salesforceConfig: jsonb("salesforce_config"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertLpFormNotificationSchema = createInsertSchema(lpFormNotificationsTable).omit({ id: true, updatedAt: true });
export type InsertLpFormNotification = z.infer<typeof insertLpFormNotificationSchema>;
export type LpFormNotification = typeof lpFormNotificationsTable.$inferSelect;
