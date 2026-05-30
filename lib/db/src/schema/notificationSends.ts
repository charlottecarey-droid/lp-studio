import { pgTable, text, serial, integer, timestamp, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";
import { appUsersTable } from "./appUsers";

/**
 * Notification sends — one row per (recipient, channel) delivery attempt.
 *
 * Serves two jobs at once:
 *   1. In-app INBOX — every `channel = 'in_app'` row IS an inbox item; the
 *      bell/inbox UI reads these for the signed-in user. `read_at` tracks the
 *      read state.
 *   2. IDEMPOTENCY — `dedupe_key` (unique per channel) lets the dispatcher
 *      claim-before-send so a lifecycle nudge is delivered at most once per
 *      recipient per milestone, even under overlapping sweeps or process
 *      restarts.
 *
 * Email rows record the delivery outcome (`status`, `sent_at`, `error`). A
 * failed email row is deleted by the dispatcher so the next sweep can retry —
 * the same "don't permanently silence on a transient provider failure" rule
 * the slug-expiry warning follows.
 */
export const notificationSendsTable = pgTable("notification_sends", {
  id: serial("id").primaryKey(),
  // Nullable so a future platform-wide (tenant-less) notice still fits.
  tenantId: integer("tenant_id").references(() => tenantsTable.id, { onDelete: "cascade" }),
  // The in-app recipient. Null for email-only recipients that have no
  // app_users row yet (invited-but-never-signed-in admins).
  appUserId: integer("app_user_id").references(() => appUsersTable.id, { onDelete: "cascade" }),
  recipientEmail: text("recipient_email"),
  templateKey: text("template_key").notNull(),
  channel: text("channel").notNull(), // 'email' | 'in_app'
  status: text("status").notNull().default("pending"), // pending | sent | failed | skipped
  // Rendered snapshot (what was actually delivered).
  title: text("title"),
  subject: text("subject"),
  body: text("body"),
  // Link the inbox item / email CTA points at (in-app row stores it so the
  // bell can render a clickable item).
  ctaUrl: text("cta_url"),
  ctaLabel: text("cta_label"),
  dedupeKey: text("dedupe_key").notNull(),
  readAt: timestamp("read_at", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  error: text("error"),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  // At most one delivery per (dedupe_key, channel) — the idempotency contract.
  uniqueIndex("notification_sends_dedupe_channel_idx").on(t.dedupeKey, t.channel),
  // Inbox hot path: a user's unread/recent in-app items.
  index("notification_sends_inbox_idx").on(t.appUserId, t.channel, t.createdAt),
  // Per-tenant lookups (superadmin send stats).
  index("notification_sends_tenant_idx").on(t.tenantId),
]);

export type NotificationSend = typeof notificationSendsTable.$inferSelect;
export type InsertNotificationSend = typeof notificationSendsTable.$inferInsert;
