import { pgTable, text, serial, timestamp, integer, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * Partner rooms (Nov 2026) — the working state behind a customer-facing room
 * page (a page built on the Content Hub family with a `hub-plan` block).
 *
 * The page's blocks define WHAT the tasks are; these tables hold what
 * happened: who may act, which tasks the customer completed, and the files
 * they handed over. Visitors act through public endpoints after proving who
 * they are (a personal link, or an emailed link sent to an allowed address);
 * the tenant reads everything through authenticated endpoints.
 *
 * No FK to lp_pages (same reasoning as lp_asset_events): deleting a page must
 * not silently destroy files a customer uploaded. The tenant id is stamped
 * server-side from the page row, never trusted from the browser.
 */

/** One row per room page: who is allowed in, and where to post activity. */
export const lpRoomSettingsTable = pgTable("lp_room_settings", {
  pageId: integer("page_id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  /** Email domains whose addresses may act without approval (lower-case, no "@"). */
  allowedDomains: jsonb("allowed_domains").$type<string[]>().notNull().default([]),
  /** Slack channel for this room's activity. Null = the tenant's default channel. */
  slackChannelId: text("slack_channel_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Individual addresses: allowed by the team, denied, or waiting on a request. */
export const lpRoomMembersTable = pgTable(
  "lp_room_members",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id").notNull(),
    pageId: integer("page_id").notNull(),
    email: text("email").notNull(),
    /** "allowed" | "requested" | "denied" */
    status: text("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("lp_room_members_page_email_uniq").on(t.pageId, t.email)],
);

/** A task the customer completed (a row exists only while it is done). */
export const lpRoomTaskStateTable = pgTable(
  "lp_room_task_state",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id").notNull(),
    pageId: integer("page_id").notNull(),
    taskKey: text("task_key").notNull(),
    completedByEmail: text("completed_by_email").notNull(),
    completedByName: text("completed_by_name"),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("lp_room_task_state_page_task_uniq").on(t.pageId, t.taskKey)],
);

/** A file a customer handed over. Stored privately; only the tenant can download it. */
export const lpRoomUploadsTable = pgTable(
  "lp_room_uploads",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id").notNull(),
    pageId: integer("page_id").notNull(),
    taskKey: text("task_key").notNull(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    /** Private object path (never a public serve URL). */
    objectPath: text("object_path").notNull(),
    uploadedByEmail: text("uploaded_by_email").notNull(),
    uploadedByName: text("uploaded_by_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("lp_room_uploads_page_created_idx").on(t.pageId, t.createdAt)],
);

/** Something the customer asked for from the room, and where it stands. */
export const lpRoomRequestsTable = pgTable(
  "lp_room_requests",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id").notNull(),
    pageId: integer("page_id").notNull(),
    /** "asset_change" | "marketing" | "training" | "event" | "reporting" | "other" */
    kind: text("kind").notNull(),
    subject: text("subject").notNull(),
    details: text("details"),
    /** The launch-kit asset the request is about, when it came from "Request changes". */
    assetKey: text("asset_key"),
    /** "new" | "in_progress" | "review" | "done" */
    status: text("status").notNull().default("new"),
    /** Who at the tenant is handling it (free text: a name or a team). */
    owner: text("owner"),
    /** Target date as the team wrote it ("Nov 21"). */
    due: text("due"),
    requestedByEmail: text("requested_by_email").notNull(),
    requestedByName: text("requested_by_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("lp_room_requests_page_created_idx").on(t.pageId, t.createdAt)],
);

export type LpRoomRequest = typeof lpRoomRequestsTable.$inferSelect;
export type LpRoomSettings = typeof lpRoomSettingsTable.$inferSelect;
export type LpRoomMember = typeof lpRoomMembersTable.$inferSelect;
export type LpRoomTaskState = typeof lpRoomTaskStateTable.$inferSelect;
export type LpRoomUpload = typeof lpRoomUploadsTable.$inferSelect;
