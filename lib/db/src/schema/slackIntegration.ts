import { pgTable, text, serial, timestamp, jsonb, integer, boolean, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";

/**
 * Slack Notifier — first-class, OUTBOUND-ONLY Slack integration.
 *
 * Mirrors the dedicated Salesforce / Marketo integrations (see
 * `sfdcIntegration.ts` / `marketoIntegration.ts`) rather than bolting onto the
 * generic `lp_integrations` provider row. Slack connects via OAuth v2; we keep
 * the bot token + incoming-webhook url (both encrypted at rest) and post Block
 * Kit messages to a tenant-configured channel on three events:
 *   - a new lead / form submission,
 *   - a hot-visit (a known contact viewing a microsite),
 *   - an AI Briefing run.
 *
 * This is deliberately one-way: we never read messages back from Slack and
 * there is no bidirectional sync. Every connection lookup REQUIRES an explicit,
 * non-optional tenant id — there is NO cross-tenant fallback.
 */

/**
 * Slack Connection — one row per (tenant, team) pair. Each tenant connects
 * their own Slack workspace.
 */
export const slackConnectionsTable = pgTable("slack_connections", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  teamId: text("team_id").notNull(),                      // Slack workspace/team id (T...)
  teamName: text("team_name"),                            // human-readable workspace name
  accessToken: text("access_token").notNull(),            // bot token (xoxb-…), encrypted at rest via encryptCredential() (v1: envelope); read paths decrypt via decryptCredential()
  botUserId: text("bot_user_id"),                         // bot user id (U…) returned by oauth.v2.access
  incomingWebhookUrl: text("incoming_webhook_url"),       // optional incoming-webhook url, encrypted at rest via encryptCredential()
  defaultChannelId: text("default_channel_id"),           // channel posts are routed to (C…)
  defaultChannelName: text("default_channel_name"),       // human-readable channel name (#sales-alerts)
  eventToggles: jsonb("event_toggles").notNull().default({ form_submit: true, hot_visit: true, ai_briefing: true }),
  status: text("status").notNull().default("connected"),  // connected | disconnected | error
  lastError: text("last_error"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  tenantIdx: index("idx_slack_connections_tenant_id").on(t.tenantId),
  tenantTeamUnique: unique("uq_slack_connections_tenant_team").on(t.tenantId, t.teamId),
}));

export const insertSlackConnectionSchema = createInsertSchema(slackConnectionsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertSlackConnection = z.infer<typeof insertSlackConnectionSchema>;
export type SlackConnection = typeof slackConnectionsTable.$inferSelect;

/** Shape of the per-event toggle map stored in `event_toggles`. */
export interface SlackEventToggles {
  form_submit: boolean;
  hot_visit: boolean;
  ai_briefing: boolean;
}
