import { pgTable, text, serial, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { salesAccountsTable } from "./salesAccounts";

/**
 * Sales Briefings — AI-generated account research stored per account.
 */
export const salesBriefingsTable = pgTable("sales_briefings", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull().references(() => salesAccountsTable.id, { onDelete: "cascade" }),
  briefingData: jsonb("briefing_data").notNull().default({}),
  status: text("status").notNull().default("complete"), // pending | complete | error
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSalesBriefingSchema = createInsertSchema(salesBriefingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSalesBriefing = z.infer<typeof insertSalesBriefingSchema>;
export type SalesBriefing = typeof salesBriefingsTable.$inferSelect;
