import { pgTable, text, serial, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { salesContactsTable } from "./salesContacts";
import { salesAccountsTable } from "./salesAccounts";

/**
 * Sales Inbound Emails — replies and inbound emails received from contacts.
 * Populated via the POST /api/sales/inbound webhook (Resend inbound routing).
 */
export const salesInboundEmailsTable = pgTable("sales_inbound_emails", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").references(() => salesContactsTable.id, { onDelete: "set null" }),
  accountId: integer("account_id").references(() => salesAccountsTable.id, { onDelete: "set null" }),
  messageId: text("message_id"),
  inReplyTo: text("in_reply_to"),
  fromEmail: text("from_email").notNull(),
  fromName: text("from_name"),
  toEmail: text("to_email").notNull(),
  subject: text("subject"),
  bodyText: text("body_text"),
  bodyHtml: text("body_html"),
  isRead: text("is_read").notNull().default("false"),
  metadata: jsonb("metadata").default({}),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSalesInboundEmailSchema = createInsertSchema(salesInboundEmailsTable).omit({ id: true, receivedAt: true });
export type InsertSalesInboundEmail = z.infer<typeof insertSalesInboundEmailSchema>;
export type SalesInboundEmail = typeof salesInboundEmailsTable.$inferSelect;
