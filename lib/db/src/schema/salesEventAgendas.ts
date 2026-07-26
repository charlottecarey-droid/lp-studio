import { pgTable, text, serial, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * One picked session on an agenda, in display order. blurbOverride is the
 * rep-edited (or AI-drafted) "why this matters for this account" line.
 */
export interface AgendaSelection {
  sessionId: number;
  blurbOverride?: string;
}

/**
 * Sales Event Agendas — the per-account artifact assembled from an event's
 * session catalog. Selections live here (not only in lp_page props) so
 * re-matching after catalog edits, PDF export, and per-event analytics all
 * work from the same row.
 */
export const salesEventAgendasTable = pgTable("sales_event_agendas", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(),
  tenantId: integer("tenant_id").notNull(),
  accountId: integer("account_id"),          // FK sales_accounts, SET NULL on account delete (agenda outlives re-sync churn)
  accountNameSnapshot: text("account_name_snapshot"), // denormalized so the agenda stays labeled if the account row churns
  attendeeRoles: jsonb("attendee_roles").$type<string[]>().default([]),
  selections: jsonb("selections").$type<AgendaSelection[]>().default([]),
  personalNote: text("personal_note"),       // account-team welcome letter shown on the page
  status: text("status").notNull().default("draft"), // draft | published
  lpPageId: integer("lp_page_id"),           // FK lp_pages, SET NULL on page delete; set on first publish, reused after
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSalesEventAgendaSchema = createInsertSchema(salesEventAgendasTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSalesEventAgenda = z.infer<typeof insertSalesEventAgendaSchema>;
export type SalesEventAgenda = typeof salesEventAgendasTable.$inferSelect;
