import { pgTable, text, serial, timestamp, jsonb, integer, boolean, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";

/**
 * Marketo Phase 2 — dedicated, bidirectional Marketo integration tables.
 *
 * This mirrors the dedicated Salesforce (SFDC) integration (see
 * `sfdcIntegration.ts`) instead of bolting credentials onto the generic
 * `lp_integrations` provider row (that was Phase 1, outbound-only). Marketo
 * uses client-credentials auth (Munchkin id + REST/identity endpoints +
 * client id/secret), so there is no user-facing OAuth redirect.
 *
 * SYSTEM-OF-RECORD: Salesforce wins for shared fields whenever a contact has a
 * Salesforce id. Marketo only writes engagement-specific fields (scores,
 * activity, list membership) into contact metadata.
 *
 * Every table carries a `tenant_id NOT NULL` FK (ON DELETE CASCADE) + index
 * from the first migration — there is no cross-tenant connection fallback.
 */

/**
 * Marketo Connection — one row per (tenant, munchkin) pair. Each tenant can
 * connect their own Marketo instance.
 */
export const marketoConnectionsTable = pgTable("marketo_connections", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  munchkinId: text("munchkin_id").notNull(),            // e.g. 123-ABC-456
  restEndpoint: text("rest_endpoint").notNull(),         // e.g. https://123-ABC-456.mktorest.com/rest
  identityEndpoint: text("identity_endpoint").notNull(), // e.g. https://123-ABC-456.mktorest.com/identity
  clientId: text("client_id").notNull(),                 // Marketo REST API client id
  clientSecret: text("client_secret").notNull(),         // encrypted at rest via encryptCredential() (v1: envelope); read paths decrypt via decryptCredential(); legacy plaintext rows pass through until backfilled
  accessToken: text("access_token"),                     // encrypted at rest via encryptCredential() (v1: envelope); nullable until first token fetch; read paths decrypt via decryptCredential()
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
  status: text("status").notNull().default("connected"), // connected | disconnected | error
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  lastSyncError: text("last_sync_error"),
  syncEnabled: boolean("sync_enabled").notNull().default(true),
  importUnlinkedLeads: boolean("import_unlinked_leads").notNull().default(false),
  enrollListId: text("enroll_list_id"),                  // Marketo static list id new LP form leads are enrolled into
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  tenantIdx: index("idx_marketo_connections_tenant_id").on(t.tenantId),
  tenantMunchkinUnique: unique("uq_marketo_connections_tenant_munchkin").on(t.tenantId, t.munchkinId),
}));

export const insertMarketoConnectionSchema = createInsertSchema(marketoConnectionsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertMarketoConnection = z.infer<typeof insertMarketoConnectionSchema>;
export type MarketoConnection = typeof marketoConnectionsTable.$inferSelect;

/**
 * Marketo Field Mappings — configurable mapping between Marketo lead attributes
 * and LP Studio tables. `direction` controls whether the mapping applies to
 * inbound import, outbound push, or both.
 */
export const marketoFieldMappingsTable = pgTable("marketo_field_mappings", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  connectionId: integer("connection_id").notNull().references(() => marketoConnectionsTable.id, { onDelete: "cascade" }),
  marketoField: text("marketo_field").notNull(),         // Marketo lead attribute REST name, e.g. "email", "leadScore"
  localTable: text("local_table").notNull(),             // sales_accounts | sales_contacts | sales_signals
  localField: text("local_field").notNull(),             // e.g. "email", "metadata.leadScore"
  direction: text("direction").notNull().default("both"), // inbound | outbound | both
  isActive: boolean("is_active").notNull().default(true),
  transformFn: text("transform_fn"),                     // optional whitelisted transform name
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index("idx_marketo_field_mappings_tenant_id").on(t.tenantId),
  connectionIdx: index("idx_marketo_field_mappings_connection_id").on(t.connectionId),
}));

export const insertMarketoFieldMappingSchema = createInsertSchema(marketoFieldMappingsTable).omit({
  id: true, createdAt: true,
});
export type InsertMarketoFieldMapping = z.infer<typeof insertMarketoFieldMappingSchema>;
export type MarketoFieldMapping = typeof marketoFieldMappingsTable.$inferSelect;

/**
 * Marketo Sync Log — per-run audit trail. `lastCursor` persists Marketo's
 * `nextPageToken` so a partial run can resume from where it left off.
 */
export const marketoSyncLogTable = pgTable("marketo_sync_log", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  connectionId: integer("connection_id").notNull().references(() => marketoConnectionsTable.id, { onDelete: "cascade" }),
  syncType: text("sync_type").notNull(),                 // full | incremental | manual
  objectType: text("object_type").notNull(),             // leads | lists | programs | activities
  recordsProcessed: integer("records_processed").default(0),
  recordsCreated: integer("records_created").default(0),
  recordsUpdated: integer("records_updated").default(0),
  recordsSkipped: integer("records_skipped").default(0),
  status: text("status").notNull().default("running"),   // running | completed | failed
  errorMessage: text("error_message"),
  lastCursor: text("last_cursor"),                       // Marketo nextPageToken for resumable pagination
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (t) => ({
  tenantIdx: index("idx_marketo_sync_log_tenant_id").on(t.tenantId),
  connectionIdx: index("idx_marketo_sync_log_connection_id").on(t.connectionId),
}));

export type MarketoSyncLog = typeof marketoSyncLogTable.$inferSelect;

/**
 * Marketo Lists — cached static lists / programs / smart lists available to
 * map. Refreshed on discovery (~1h TTL) to avoid hammering the rate-limited API
 * each time the settings page loads.
 */
export const marketoListsTable = pgTable("marketo_lists", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  connectionId: integer("connection_id").notNull().references(() => marketoConnectionsTable.id, { onDelete: "cascade" }),
  marketoId: text("marketo_id").notNull(),               // Marketo list/program id
  listType: text("list_type").notNull(),                 // static_list | program | smart_list
  name: text("name").notNull(),
  description: text("description"),
  metadata: jsonb("metadata").default({}),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index("idx_marketo_lists_tenant_id").on(t.tenantId),
  connectionIdx: index("idx_marketo_lists_connection_id").on(t.connectionId),
  connectionMarketoUnique: unique("uq_marketo_lists_connection_marketo_id").on(t.connectionId, t.marketoId, t.listType),
}));

export type MarketoList = typeof marketoListsTable.$inferSelect;

/**
 * Marketo Activities Pushed — idempotency ledger for outbound activity writes.
 * Before pushing an activity for a local event we check for an existing row;
 * after a successful push we record the returned Marketo activity id. This
 * refuses to push the same activity twice on retry.
 */
export const marketoActivitiesPushedTable = pgTable("marketo_activities_pushed", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  connectionId: integer("connection_id").notNull().references(() => marketoConnectionsTable.id, { onDelete: "cascade" }),
  localEventId: text("local_event_id").notNull(),        // local idempotency key (e.g. "email_sent:<signalId>")
  eventType: text("event_type").notNull(),               // email_sent | microsite_view | engagement_score
  marketoActivityId: text("marketo_activity_id"),        // id returned by Marketo (nullable in fake/dev mode)
  pushedAt: timestamp("pushed_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index("idx_marketo_activities_pushed_tenant_id").on(t.tenantId),
  connectionIdx: index("idx_marketo_activities_pushed_connection_id").on(t.connectionId),
  connectionEventUnique: unique("uq_marketo_activities_pushed_connection_event").on(t.connectionId, t.localEventId),
}));

export type MarketoActivityPushed = typeof marketoActivitiesPushedTable.$inferSelect;
