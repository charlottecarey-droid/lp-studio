import { pgTable, serial, integer, text, jsonb, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";

/**
 * Per-tenant override of WHO receives each "broadcast" notification email
 * (Task #614).
 *
 * A "broadcast" alert is one that historically went to a FIXED audience for the
 * whole workspace (every member, or every admin) rather than to one specific
 * person. This table lets a workspace admin re-target each alert type:
 *
 *   - `member_user_ids` — app_users.id of the workspace members who should
 *     receive the alert. Resolved to their CURRENT email at send time, so a
 *     member who leaves / changes email is handled automatically.
 *   - `extra_emails` — additional raw addresses (e.g. a shared ops inbox or an
 *     external stakeholder who isn't a workspace member).
 *
 * The PRESENCE of a row = the alert is CONFIGURED. Absence = keep today's
 * legacy default audience (all members for collaboration alerts, all admins for
 * account/billing alerts). Account/billing alert types additionally FAIL OPEN:
 * if a configured row resolves to zero valid recipients, the resolver falls
 * back to all admins so a critical billing/domain warning is never silently
 * dropped. (Enforced in the api-server resolver, not the schema.)
 *
 * `alert_type` is one of the code-owned broadcast alert keys
 * (`comment`, `review_decision`, `trial_expiry`, `slug_redirect_expiry`,
 * `payment_failed`, `custom_domain_status`). Uniqueness is one row per
 * (tenant_id, alert_type).
 */
export const broadcastAlertRecipientsTable = pgTable("broadcast_alert_recipients", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenantsTable.id, { onDelete: "cascade" }),
  alertType: text("alert_type").notNull(),
  // JSON array of app_users.id (number[]).
  memberUserIds: jsonb("member_user_ids").notNull().default([]),
  // JSON array of raw email addresses (string[]).
  extraEmails: jsonb("extra_emails").notNull().default([]),
  // JSON array of dynamic group tokens (Task #623). Self-updating audiences that
  // resolve to the CURRENT roster at send time: "all_admins", "all_members",
  // "page_author" (page_author only applies to page-scoped collaboration alerts).
  groups: jsonb("groups").notNull().default([]),
  // Audit: the app_user who last saved this config (best-effort, nullable).
  updatedBy: integer("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}, (t) => [
  uniqueIndex("broadcast_alert_recipients_unique_idx").on(t.tenantId, t.alertType),
]);

export type BroadcastAlertRecipients = typeof broadcastAlertRecipientsTable.$inferSelect;
export type InsertBroadcastAlertRecipients = typeof broadcastAlertRecipientsTable.$inferInsert;
