import { pgTable, text, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";

/**
 * Notification templates — one row per platform lifecycle/system message
 * (`welcome`, `trial_day_7`, `trial_day_11`, `trial_day_13`, ...).
 *
 * The canonical copy + channel set for every template lives in code
 * (`artifacts/api-server/src/lib/notificationTemplates.ts`). This table stores
 * the SuperAdmin-editable OVERRIDES so an operator can re-word a nudge, change
 * its subject, or switch it off WITHOUT a code deploy. The dispatcher reads
 * this table through a cached accessor and falls back to the code defaults when
 * a row is missing or the DB is unavailable (same pattern as `plan_config`).
 *
 * `channels` is a JSON array of `"email" | "in_app"`. `enabled = false` makes
 * the dispatcher skip the template entirely (no email, no inbox item).
 */
export const notificationTemplatesTable = pgTable("notification_templates", {
  // Stable string key the dispatcher addresses templates by. Never edited.
  key: text("key").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  // 'lifecycle' (trial nudges, welcome) | 'system' (ops alerts). Display-only.
  category: text("category").notNull().default("lifecycle"),
  // JSON array of delivery channels: ["email","in_app"].
  channels: jsonb("channels").notNull().default(["in_app"]),
  // Email channel — subject line + the single editable intro paragraph that
  // gets dropped into the branded HTML wrapper (kept in code). null = use the
  // code default.
  emailSubject: text("email_subject"),
  emailIntro: text("email_intro"),
  emailCtaLabel: text("email_cta_label"),
  // In-app channel — inbox title + body. null = use the code default.
  inAppTitle: text("in_app_title"),
  inAppBody: text("in_app_body"),
  enabled: boolean("enabled").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type NotificationTemplate = typeof notificationTemplatesTable.$inferSelect;
export type InsertNotificationTemplate = typeof notificationTemplatesTable.$inferInsert;
