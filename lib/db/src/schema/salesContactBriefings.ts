import { pgTable, text, serial, timestamp, integer, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { salesContactsTable } from "./salesContacts";
import { tenantsTable } from "./tenants";

/**
 * Sales Contact Briefings — AI-generated per-person call-prep briefs.
 *
 * Mirrors `salesBriefings` (account-level intelligence) but keyed on a
 * specific contact so reps can pull up the same pre-call brief that
 * `DraftEmailModal` produces on demand without regenerating it every visit.
 *
 * `briefText` is the raw markdown returned by the LLM (the existing
 * /api/sales/person-brief endpoint already returns text rather than a
 * structured payload — see person-brief.ts). We persist it as-is and let
 * the UI render it; this keeps the table simple and avoids a brittle
 * structured schema that would have to be migrated whenever the prompt
 * changes.
 *
 * One row per (tenant, contact) — uniqueness enforced so "save the latest
 * brief" is a clean UPSERT instead of an unbounded append-only history.
 */
export const salesContactBriefingsTable = pgTable("sales_contact_briefings", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  contactId: integer("contact_id").notNull().references(() => salesContactsTable.id, { onDelete: "cascade" }),
  briefText: text("brief_text").notNull().default(""),
  status: text("status").notNull().default("complete"), // pending | complete | error
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  tenantIdx: index("idx_sales_contact_briefings_tenant_id").on(t.tenantId),
  contactUnique: uniqueIndex("uq_sales_contact_briefings_tenant_contact").on(t.tenantId, t.contactId),
}));

export const insertSalesContactBriefingSchema = createInsertSchema(salesContactBriefingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSalesContactBriefing = z.infer<typeof insertSalesContactBriefingSchema>;
export type SalesContactBriefing = typeof salesContactBriefingsTable.$inferSelect;
