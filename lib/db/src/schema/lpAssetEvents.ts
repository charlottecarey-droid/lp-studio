import { pgTable, text, serial, timestamp, integer, index } from "drizzle-orm/pg-core";

/**
 * Content Hub asset engagement (Oct 2026).
 *
 * One row per visitor action on a hub resource: `view` (opened in the
 * in-page viewer), `open` (opened in a new tab / external link) or
 * `download`. Keyed by a stable per-asset key chosen by the block (an
 * explicit key, else a slug of the title) so counts survive copy edits.
 *
 * No FK to lp_pages on purpose: a deleted page must not cascade away its
 * engagement history — the analytics drill-down keeps reporting it. The
 * tenant id is stamped server-side from the page row, never trusted from
 * the beacon.
 */
export const lpAssetEventsTable = pgTable(
  "lp_asset_events",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id").notNull(),
    pageId: integer("page_id").notNull(),
    blockId: text("block_id"),
    assetKey: text("asset_key").notNull(),
    assetTitle: text("asset_title"),
    assetKind: text("asset_kind").notNull(),
    action: text("action").notNull(),
    sessionId: text("session_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("lp_asset_events_page_created_idx").on(t.pageId, t.createdAt)],
);

export type LpAssetEvent = typeof lpAssetEventsTable.$inferSelect;
