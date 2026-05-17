import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { salesContactsTable } from "./salesContacts";
import { lpPagesTable } from "./lpPages";

/**
 * Sales Hotlinks — tracked links per contact per page.
 * 8-char token → resolves to page URL with contact attribution.
 *
 * contact_id is nullable with SET NULL so hotlinks survive contact deletion
 * during Salesforce re-sync. sfdc_contact_id is the stable identifier used
 * to re-associate hotlinks to the newly imported contact records.
 */
export const salesHotlinksTable = pgTable("sales_hotlinks", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  contactId: integer("contact_id").references(() => salesContactsTable.id, { onDelete: "set null" }),
  sfdcContactId: text("sfdc_contact_id"),   // stable SFDC Contact ID (e.g. 003xxx)
  pageId: integer("page_id").notNull().references(() => lpPagesTable.id, { onDelete: "cascade" }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSalesHotlinkSchema = createInsertSchema(salesHotlinksTable).omit({ id: true, createdAt: true });
export type InsertSalesHotlink = z.infer<typeof insertSalesHotlinkSchema>;
export type SalesHotlink = typeof salesHotlinksTable.$inferSelect;
