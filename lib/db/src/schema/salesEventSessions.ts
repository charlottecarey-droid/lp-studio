import { pgTable, text, serial, timestamp, jsonb, integer, boolean, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/** A speaker as displayed on session cards. */
export interface EventSessionSpeaker {
  name: string;
  title?: string;
  org?: string;
}

/**
 * Matching tags. Deterministic agenda matching intersects these with the
 * account's attributes + the rep-picked attendee roles; tags edited in-app
 * win over re-imported values (see the events route upsert).
 */
export interface EventSessionTags {
  roles?: string[];       // attendee roles the session targets ("COO", "Clinical Director")
  industries?: string[];  // account industries the session is relevant to
  topics?: string[];      // free-form topic labels for filtering
  tiers?: string[];       // ABM tiers ("Tier 1") the session is reserved for/aimed at
}

/**
 * Sales Event Sessions — the per-event session catalog rows agendas are
 * assembled from.
 */
export const salesEventSessionsTable = pgTable("sales_event_sessions", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(),
  tenantId: integer("tenant_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  day: date("day"),                          // calendar day of the session
  startTime: text("start_time"),             // "09:00" 24h local — text keeps import lossless across TZ-less sources
  endTime: text("end_time"),
  room: text("room"),
  sessionType: text("session_type"),         // "Keynote" | "Workshop" | "Breakout" | ...
  track: text("track"),
  speakers: jsonb("speakers").$type<EventSessionSpeaker[]>().default([]),
  tags: jsonb("tags").$type<EventSessionTags>().default({}),
  tagsEditedInApp: boolean("tags_edited_in_app").notNull().default(false), // re-import must not clobber manual tag edits
  isReservedSlot: boolean("is_reserved_slot").notNull().default(false),    // pinned slots (account-team 1:1, dinner) always make the agenda
  sourceKey: text("source_key"),             // dedupe key for re-import (slug of title+day+start_time)
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSalesEventSessionSchema = createInsertSchema(salesEventSessionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSalesEventSession = z.infer<typeof insertSalesEventSessionSchema>;
export type SalesEventSession = typeof salesEventSessionsTable.$inferSelect;
