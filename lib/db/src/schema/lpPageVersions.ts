import { pgTable, text, serial, timestamp, jsonb, integer, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Page version history (migration 0175). One row per snapshot of a page's
 * editable content, taken BEFORE a save that changes it (coalesced per editing
 * session), before a restore, and before a delete. `page_id` is deliberately
 * not a foreign key: a deleted page's versions outlive the page so it can be
 * brought back. See api-server/src/lib/pageVersions.ts.
 *
 * reason: 'save' | 'checkpoint' | 'restore' | 'delete' | 'publish' | 'unpublish'
 * note:   optional changelog line ("Swapped hero copy for v3b").
 */
export const lpPageVersionsTable = pgTable(
  "lp_page_versions",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id").notNull(),
    pageId: integer("page_id").notNull(),
    title: text("title").notNull().default(""),
    slug: text("slug").notNull().default(""),
    status: text("status").notNull().default("draft"),
    snapshot: jsonb("snapshot").notNull(),
    reason: text("reason").notNull().default("save"),
    note: text("note"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("lp_page_versions_page_idx").on(table.tenantId, table.pageId, table.createdAt.desc()),
    index("lp_page_versions_deleted_idx").on(table.tenantId, table.createdAt.desc()).where(sql`${table.reason} = 'delete'`),
  ],
);

export type LpPageVersion = typeof lpPageVersionsTable.$inferSelect;
