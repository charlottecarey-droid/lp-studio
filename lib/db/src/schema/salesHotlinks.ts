import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { salesContactsTable } from "./salesContacts";
import { lpPagesTable } from "./lpPages";

/**
 * Sales Hotlinks — tracked links per contact per page.
 * 8-char token → resolves to page URL with contact attribution.
 */
export const salesHotlinksTable = pgTable("sales_hotlinks", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),       // 8-char unique token
  contactId: integer("contact_id").notNull().references(() => salesContactsTable.id, { onDelete: "cascade" }),
  pageId: integer("page_id").notNull().references(() => lpPagesTable.id, { onDelete: "cascade" }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSalesHotlinkSchema = createInsertSchema(salesHotlinksTable).omit({ id: true, createdAt: true });
export type InsertSalesHotlink = z.infer<typeof insertSalesHotlinkSchema>;
export type SalesHotlink = typeof salesHotlinksTable.$inferSelect;
