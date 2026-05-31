import { pgTable, serial, integer, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";
import { appUsersTable } from "./appUsers";

/**
 * Per-recipient email preference store (Task #587).
 *
 * A row's PRESENCE = the recipient has OPTED OUT of that (template_key, channel)
 * pair. Absence = subscribed (the default). The dispatcher only ever consults /
 * writes this for `category = 'lifecycle'` templates; system/transactional
 * emails (auth, billing) always send and are never suppressed here.
 *
 * The `channel` column is carried so an in-app opt-out could be added later
 * without a schema change; today only the email channel is toggled, leaving the
 * in-app inbox unaffected.
 */
export const notificationPreferencesTable = pgTable("notification_preferences", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenantsTable.id, { onDelete: "cascade" }),
  appUserId: integer("app_user_id")
    .notNull()
    .references(() => appUsersTable.id, { onDelete: "cascade" }),
  templateKey: text("template_key").notNull(),
  channel: text("channel").notNull(), // 'email' | 'in_app'
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("notification_preferences_unique_idx").on(
    t.tenantId,
    t.appUserId,
    t.templateKey,
    t.channel,
  ),
  index("notification_preferences_lookup_idx").on(t.tenantId, t.appUserId),
]);

export type NotificationPreference = typeof notificationPreferencesTable.$inferSelect;
export type InsertNotificationPreference = typeof notificationPreferencesTable.$inferInsert;
