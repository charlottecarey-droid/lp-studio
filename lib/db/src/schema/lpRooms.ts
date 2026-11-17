import { pgTable, text, serial, timestamp, integer, jsonb, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

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
  /** Salesforce Account id of the customer's parent account (practices are its child accounts). */
  sfdcAccountId: text("sfdc_account_id"),
  /** Asana project for this room's marketing requests. Null = the tenant's Asana project. */
  asanaProjectGid: text("asana_project_gid"),
  /** Weekly digest: off until the team turns it on; recipients are the customer addresses it emails. */
  digestEnabled: boolean("digest_enabled").notNull().default(false),
  digestRecipients: jsonb("digest_recipients").$type<string[]>().notNull().default([]),
  lastDigestAt: timestamp("last_digest_at", { withTimezone: true }),
  /** A live Google Sheet that IS the practice list while connected (read through the workspace's Sheets connection). */
  practicesSheetId: text("practices_sheet_id"),
  practicesSheetTab: text("practices_sheet_tab"),
  practicesSyncedAt: timestamp("practices_synced_at", { withTimezone: true }),
  /** How the last read went ("122 practices" or the error), shown to the team. */
  practicesSyncNote: text("practices_sync_note"),
  /** Keep only sheet rows where this column contains this value (a report that lists every customer's practices). */
  practicesSheetFilterColumn: text("practices_sheet_filter_column"),
  practicesSheetFilterValue: text("practices_sheet_filter_value"),
  /** Slack id to mention about Salesforce gaps: a user group (S…) or a user (U…). */
  revopsSlackMention: text("revops_slack_mention"),
  /** The Google Calendar this room reads ("primary" or a calendar id). Null = not connected. */
  calendarId: text("calendar_id"),
  calendarSyncedAt: timestamp("calendar_synced_at", { withTimezone: true }),
  calendarSyncNote: text("calendar_sync_note"),
  /** The team member's Google connection this room reads its calendar and notes through. Null = the workspace connector. */
  calendarConnectionId: integer("calendar_connection_id"),
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
    /** The Asana task created for a marketing request. */
    asanaTaskGid: text("asana_task_gid"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("lp_room_requests_page_created_idx").on(t.pageId, t.createdAt)],
);

/** A practice (location) in a room's rollout. `stage`: not_started | scheduling | training_booked | trained | live. */
export const lpRoomPracticesTable = pgTable(
  "lp_room_practices",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id").notNull(),
    pageId: integer("page_id").notNull(),
    /** Salesforce Account id when it came from Salesforce; lets a re-sync update in place. */
    externalId: text("external_id"),
    name: text("name").notNull(),
    region: text("region"),
    city: text("city"),
    state: text("state"),
    wave: text("wave"),
    stage: text("stage").notNull().default("not_started"),
    trainingDate: text("training_date"),
    liveDate: text("live_date"),
    /** When the practice's scanner was sent and when it was activated, as the source writes them. */
    scannerSent: text("scanner_sent"),
    scannerActivated: text("scanner_activated"),
    regionalManager: text("regional_manager"),
    /** Scanners at the practice now, and which models ("1 Trios 3 · 3 Dandy Vision"). */
    scannerCount: integer("scanner_count"),
    scannerModels: text("scanner_models"),
    /** More of what the Salesforce report carries, as written there: the scanner brand at the office, when its contract was signed, its status in Salesforce's words. */
    scannerBrand: text("scanner_brand"),
    contractSigned: text("contract_signed"),
    sourceStatus: text("source_status"),
    /** Internal: the account owner and the last sales activity. Shown to the team only. */
    owner: text("owner"),
    lastActivity: text("last_activity"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("lp_room_practices_page_idx").on(t.pageId, t.region), uniqueIndex("lp_room_practices_page_ext_uniq").on(t.pageId, t.externalId).where(sql`${t.externalId} IS NOT NULL`)],
);

/**
 * One row per room per day: how many practices were at each stage, so the
 * scorecard can show a trend. Written whenever the practice list is refreshed.
 */
export const lpRoomPracticeSnapshotsTable = pgTable(
  "lp_room_practice_snapshots",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id").notNull(),
    pageId: integer("page_id").notNull(),
    /** YYYY-MM-DD (UTC). */
    day: text("day").notNull(),
    total: integer("total").notNull().default(0),
    byStage: jsonb("by_stage").$type<Record<string, number>>().notNull().default({}),
    scanners: integer("scanners"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("lp_room_practice_snapshots_page_day_uniq").on(t.pageId, t.day)],
);

/**
 * A team member's Google connection (read-only Calendar events + Docs), made
 * with "Connect Google". One per member per tenant; `refreshToken` is stored
 * encrypted (encryptCredential). `status`: "connected" | "revoked".
 */
export const lpGoogleConnectionsTable = pgTable(
  "lp_google_connections",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id").notNull(),
    userId: integer("user_id").notNull(),
    userEmail: text("user_email").notNull(),
    googleEmail: text("google_email").notNull(),
    refreshToken: text("refresh_token").notNull(),
    scopes: text("scopes").notNull().default(""),
    status: text("status").notNull().default("connected"),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("lp_google_connections_tenant_user_uniq").on(t.tenantId, t.userId)],
);

/**
 * Launch-kit files that are the same for every customer (the Practice Welcome
 * Guide, the Success Guide): uploaded once per workspace, added to each room.
 */
export const lpRoomStandardAssetsTable = pgTable(
  "lp_room_standard_assets",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id").notNull(),
    assetKey: text("asset_key").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    fileUrl: text("file_url").notNull(),
    updatedBy: text("updated_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("lp_room_standard_assets_tenant_key_uniq").on(t.tenantId, t.assetKey)],
);

/** Automatic rooms: the sheet tab of signed accounts a workspace watches. One row per workspace. */
export const lpRoomAutocreateTable = pgTable("lp_room_autocreate", {
  tenantId: integer("tenant_id").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  sheetId: text("sheet_id"),
  sheetTab: text("sheet_tab"),
  /** The tab of the same workbook that lists every account's locations; a new room reads its practices from it. */
  practicesTab: text("practices_tab"),
  /** On a new room: email the account's owner (matched by name to a team member) and these addresses. */
  alertOwner: boolean("alert_owner").notNull().default(false),
  alertEmails: jsonb("alert_emails").$type<string[]>().notNull().default([]),
  /** On a new room: add a row to a sheet tab. Null sheet = the watched workbook; null tab = "Digital Sales Rooms". */
  logEnabled: boolean("log_enabled").notNull().default(true),
  logSheetId: text("log_sheet_id"),
  logTab: text("log_tab"),
  /** On a new room: write its link to this field on the Salesforce Account (API name), when Salesforce is connected. */
  sfdcField: text("sfdc_field"),
  syncedAt: timestamp("synced_at", { withTimezone: true }),
  syncNote: text("sync_note"),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Every account seen on that tab. `pageId` is the room made for it; null = it was already on the list, or creation is pending. */
export const lpRoomAutocreateAccountsTable = pgTable(
  "lp_room_autocreate_accounts",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id").notNull(),
    accountKey: text("account_key").notNull(),
    accountName: text("account_name").notNull(),
    signedDate: text("signed_date"),
    owner: text("owner"),
    /** The account's Salesforce id, when the tab has an id column. */
    sfdcAccountId: text("sfdc_account_id"),
    pageId: integer("page_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("lp_room_autocreate_accounts_tenant_key_uniq").on(t.tenantId, t.accountKey)],
);

/** What the customer may read of a meeting once the team publishes it. */
export interface RoomMinutes {
  summary: string;
  decisions: string[];
  actions: { text: string; owner?: string; due?: string; done?: boolean }[];
}

/**
 * A calendar event synced from Google Calendar (only events with a guest at
 * one of the room's allowed domains). Minutes drafted from the meeting's notes
 * doc live on the same row; `minutesStatus` is null (none), "draft" (team
 * only), "published" (customer sees them) or "dismissed".
 */
export const lpRoomEventsTable = pgTable(
  "lp_room_events",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id").notNull(),
    pageId: integer("page_id").notNull(),
    externalId: text("external_id").notNull(),
    title: text("title").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    allDay: boolean("all_day").notNull().default(false),
    hidden: boolean("hidden").notNull().default(false),
    /** Guest names for the minutes ("Levi, Dana +3"); never email addresses. */
    attendees: text("attendees"),
    /** The Google Doc of meeting notes attached to the event, when there is one. */
    notesFileId: text("notes_file_id"),
    minutesStatus: text("minutes_status"),
    minutes: jsonb("minutes").$type<RoomMinutes>(),
    minutesDraftedAt: timestamp("minutes_drafted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("lp_room_events_page_ext_uniq").on(t.pageId, t.externalId), index("lp_room_events_page_start_idx").on(t.pageId, t.startsAt)],
);

/** A decision the customer made on the page (a marketing program, an amount, an event format). */
export const lpRoomChoicesTable = pgTable(
  "lp_room_choices",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id").notNull(),
    pageId: integer("page_id").notNull(),
    choiceKey: text("choice_key").notNull(),
    value: text("value").notNull(),
    chosenByEmail: text("chosen_by_email").notNull(),
    chosenByName: text("chosen_by_name"),
    chosenAt: timestamp("chosen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("lp_room_choices_page_key_uniq").on(t.pageId, t.choiceKey)],
);

/** Someone the customer added to their side of the team. */
export const lpRoomContactsTable = pgTable(
  "lp_room_contacts",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id").notNull(),
    pageId: integer("page_id").notNull(),
    name: text("name").notNull(),
    role: text("role"),
    email: text("email"),
    addedByEmail: text("added_by_email").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("lp_room_contacts_page_idx").on(t.pageId)],
);

/** The wins feed: a post by either side ("customer" | "team"). */
export const lpRoomWinsTable = pgTable(
  "lp_room_wins",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id").notNull(),
    pageId: integer("page_id").notNull(),
    body: text("body").notNull(),
    /** Optional big line above the body ("1,000 cases submitted"). */
    headline: text("headline"),
    region: text("region"),
    /** Photos on the post: hosted paths under /api/storage/objects/uploads/. */
    images: jsonb("images").$type<string[]>().notNull().default([]),
    /** People tagged in the post, by the name shown ("@Dana Lee"). Addresses are never stored here. */
    mentions: jsonb("mentions").$type<string[]>().notNull().default([]),
    authorSide: text("author_side").notNull(),
    authorEmail: text("author_email").notNull(),
    authorName: text("author_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("lp_room_wins_page_created_idx").on(t.pageId, t.createdAt)],
);

export const lpRoomWinLikesTable = pgTable(
  "lp_room_win_likes",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id").notNull(),
    winId: integer("win_id").notNull(),
    email: text("email").notNull(),
    /** The reaction. One row per person per emoji per win. */
    emoji: text("emoji").notNull().default("❤️"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("lp_room_win_likes_win_email_emoji_uniq").on(t.winId, t.email, t.emoji)],
);

export const lpRoomWinCommentsTable = pgTable(
  "lp_room_win_comments",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id").notNull(),
    winId: integer("win_id").notNull(),
    body: text("body").notNull(),
    mentions: jsonb("mentions").$type<string[]>().notNull().default([]),
    authorSide: text("author_side").notNull(),
    authorEmail: text("author_email").notNull(),
    authorName: text("author_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("lp_room_win_comments_win_idx").on(t.winId, t.createdAt)],
);

export type LpRoomRequest = typeof lpRoomRequestsTable.$inferSelect;
export type LpRoomSettings = typeof lpRoomSettingsTable.$inferSelect;
export type LpRoomMember = typeof lpRoomMembersTable.$inferSelect;
export type LpRoomTaskState = typeof lpRoomTaskStateTable.$inferSelect;
export type LpRoomUpload = typeof lpRoomUploadsTable.$inferSelect;
export type LpRoomEvent = typeof lpRoomEventsTable.$inferSelect;
