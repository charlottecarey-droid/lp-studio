import { pgTable, text, serial, timestamp, integer, boolean, primaryKey, index, unique } from "drizzle-orm/pg-core";
import { lpPagesTable } from "./lpPages";

export const lpPageCommentsTable = pgTable("lp_page_comments", {
  id: serial("id").primaryKey(),
  pageId: integer("page_id").notNull().references(() => lpPagesTable.id, { onDelete: "cascade" }),
  blockIndex: integer("block_index").notNull().default(0),
  authorName: text("author_name").notNull(),
  message: text("message").notNull(),
  parentId: integer("parent_id"),
  resolved: boolean("resolved").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("lp_page_comments_page_id_idx").on(table.pageId),
]);

export type LpPageComment = typeof lpPageCommentsTable.$inferSelect;
export type InsertLpPageComment = typeof lpPageCommentsTable.$inferInsert;

export const lpPageReviewsTable = pgTable("lp_page_reviews", {
  id: serial("id").primaryKey(),
  pageId: integer("page_id").notNull().references(() => lpPagesTable.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  reviewerName: text("reviewer_name"),
  status: text("status").notNull().default("pending"),
  decisionComment: text("decision_comment"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("lp_page_reviews_page_id_idx").on(table.pageId),
]);

export type LpPageReview = typeof lpPageReviewsTable.$inferSelect;
export type InsertLpPageReview = typeof lpPageReviewsTable.$inferInsert;

export const lpPagePresenceTable = pgTable("lp_page_presence", {
  id: serial("id").primaryKey(),
  pageId: integer("page_id").notNull().references(() => lpPagesTable.id, { onDelete: "cascade" }),
  viewerId: text("viewer_id").notNull(),
  displayName: text("display_name").notNull().default("Anonymous"),
  lastSeen: timestamp("last_seen", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("lp_page_presence_page_viewer_ux").on(table.pageId, table.viewerId),
  index("lp_page_presence_page_id_idx").on(table.pageId),
]);

export type LpPagePresence = typeof lpPagePresenceTable.$inferSelect;
