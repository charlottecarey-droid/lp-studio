import { pgTable, serial, integer, text, jsonb, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tenantsTable } from "./tenants";

/**
 * Admin-defined CUSTOM recipient groups for broadcast alerts (Task #629).
 *
 * The broadcast alert system ships three BUILT-IN, code-owned groups
 * (`all_admins`, `all_members`, `page_author`). This table lets a workspace
 * admin define their OWN named groups — e.g. "Billing contacts" or "Design
 * reviewers" — once and reuse them across any alert:
 *
 *   - `label`           — the human-facing name shown as a quick-pick toggle.
 *   - `member_user_ids` — app_users.id of the workspace members in the group,
 *     resolved to their CURRENT email at send time (so a member who leaves /
 *     changes email is handled automatically, exactly like the built-in groups).
 *   - `extra_emails`    — additional raw addresses (e.g. an external stakeholder
 *     or shared inbox that isn't a workspace member).
 *
 * A custom group is referenced from a `broadcast_alert_recipients.groups` array
 * by the token `custom:<id>`. Custom groups apply to EVERY alert type (both
 * collaboration and account/billing). Deleting a group cascades cleanly: the
 * DELETE route strips its `custom:<id>` token from every alert config that
 * referenced it, and resolution silently ignores tokens whose group no longer
 * exists, so a stale reference can never resolve to a recipient.
 *
 * Labels are unique per tenant (case-insensitive) so the quick-pick list stays
 * unambiguous.
 */
export const broadcastRecipientGroupsTable = pgTable("broadcast_recipient_groups", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenantsTable.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  // JSON array of app_users.id (number[]).
  memberUserIds: jsonb("member_user_ids").notNull().default([]),
  // JSON array of raw email addresses (string[]).
  extraEmails: jsonb("extra_emails").notNull().default([]),
  // Audit: the app_user who created / last saved this group (best-effort, nullable).
  createdBy: integer("created_by"),
  updatedBy: integer("updated_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}, (t) => [
  uniqueIndex("broadcast_recipient_groups_tenant_label_idx").on(t.tenantId, sql`lower(${t.label})`),
]);

export type BroadcastRecipientGroup = typeof broadcastRecipientGroupsTable.$inferSelect;
export type InsertBroadcastRecipientGroup = typeof broadcastRecipientGroupsTable.$inferInsert;
