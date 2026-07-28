import { pgTable, text, serial, timestamp, integer, date, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/** Keynote speaker as captured by a catalog import (matches the block's EvaPerson). */
export interface EventCatalogSpeaker {
  name: string;
  title?: string;
  bio?: string;
  imageUrl?: string;
}

/** Sponsor/exhibitor as captured by a catalog import (matches EvaSponsor). */
export interface EventCatalogSponsor {
  name: string;
  tier?: string;
  logoUrl?: string;
  url?: string;
}

/** Everything an import found that isn't a session. */
export interface EventCatalogExtras {
  speakers?: EventCatalogSpeaker[];
  sponsors?: EventCatalogSponsor[];
  derived?: { eventName?: string; startDate?: string; endDate?: string; venues?: string[] };
  importedAt?: string;
}

/**
 * Sales Events — a conference/summit whose session catalog is entered once
 * and reused to assemble per-account agendas (sales_event_agendas).
 */
export const salesEventsTable = pgTable("sales_events", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  name: text("name").notNull(),
  location: text("location"),                // "Austin, TX"
  startDate: date("start_date"),
  endDate: date("end_date"),
  sourceUrl: text("source_url"),             // public agenda page the catalog was imported from, if any
  /** Non-session catalog data from an import — keynote speakers, sponsors and
   *  derived event details. Copied onto the agenda block at publish time; not
   *  queried or joined, hence one jsonb rather than more tables. */
  catalogExtras: jsonb("catalog_extras").$type<EventCatalogExtras>().notNull().default({}),
  description: text("description"),
  status: text("status").notNull().default("draft"), // draft | active | archived
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSalesEventSchema = createInsertSchema(salesEventsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSalesEvent = z.infer<typeof insertSalesEventSchema>;
export type SalesEvent = typeof salesEventsTable.$inferSelect;
