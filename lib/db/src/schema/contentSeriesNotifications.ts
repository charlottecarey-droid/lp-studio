import { pgTable, serial, integer, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { lpPagesTable } from "./lpPages";

/**
 * Content Series episode-notification bookkeeping (Task #806).
 *
 * Three small tables back the "email subscribers about new episodes" feature on
 * the Content Series landing-page block. An "episode key" is the block's stable
 * per-episode identifier (slug → rssGuid → slugified title); a "subscriber" is a
 * lead captured via the block's built-in Subscribe form
 * (`lp_leads.fields._source = 'content-series-subscribe'`) on that page.
 */

/**
 * Page-level record of which episode keys have ever been present when the page
 * was published. Drives "new episode" detection on (re)publish: an episode is
 * NEW only when its key is not already in this table. Always upserted for the
 * full current set on every publish (independent of the auto-send toggle) so
 * turning auto-send on later never blasts pre-existing episodes.
 */
export const contentSeriesSeenEpisodesTable = pgTable("content_series_seen_episodes", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  pageId: integer("page_id")
    .notNull()
    .references(() => lpPagesTable.id, { onDelete: "cascade" }),
  episodeKey: text("episode_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("content_series_seen_page_episode_idx").on(t.pageId, t.episodeKey),
  index("content_series_seen_page_idx").on(t.pageId),
]);

/**
 * Per-recipient send ledger. One row per (page, episode key, recipient email)
 * guarantees at-most-once delivery per episode per subscriber, surviving
 * re-publishes and manual re-sends (the unique index is the dedupe key).
 */
export const contentSeriesEpisodeSendsTable = pgTable("content_series_episode_sends", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  pageId: integer("page_id")
    .notNull()
    .references(() => lpPagesTable.id, { onDelete: "cascade" }),
  episodeKey: text("episode_key").notNull(),
  recipientEmail: text("recipient_email").notNull(),
  leadId: integer("lead_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("content_series_sends_page_episode_email_idx").on(
    t.pageId,
    t.episodeKey,
    t.recipientEmail,
  ),
  index("content_series_sends_page_idx").on(t.pageId),
]);

/**
 * Per-page lead opt-out list. A subscriber who clicks "unsubscribe" in an
 * episode email lands here and is excluded from all future episode emails for
 * that page. Page-scoped because subscription is to a specific series/page.
 * (The existing app-user `isOptedOut`/notification-preferences system does not
 * cover external LP leads, so this is a dedicated lead-scoped opt-out store.)
 */
export const contentSeriesUnsubscribesTable = pgTable("content_series_unsubscribes", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  pageId: integer("page_id")
    .notNull()
    .references(() => lpPagesTable.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("content_series_unsub_page_email_idx").on(t.pageId, t.email),
  index("content_series_unsub_page_idx").on(t.pageId),
]);

export type ContentSeriesSeenEpisode = typeof contentSeriesSeenEpisodesTable.$inferSelect;
export type InsertContentSeriesSeenEpisode = typeof contentSeriesSeenEpisodesTable.$inferInsert;
export type ContentSeriesEpisodeSend = typeof contentSeriesEpisodeSendsTable.$inferSelect;
export type InsertContentSeriesEpisodeSend = typeof contentSeriesEpisodeSendsTable.$inferInsert;
export type ContentSeriesUnsubscribe = typeof contentSeriesUnsubscribesTable.$inferSelect;
export type InsertContentSeriesUnsubscribe = typeof contentSeriesUnsubscribesTable.$inferInsert;
