import { pgTable, text, serial, timestamp, jsonb, integer, boolean, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";

/**
 * HubSpot — dedicated, bidirectional HubSpot CRM integration tables.
 *
 * This mirrors the dedicated Marketo Phase 2 integration (see
 * `marketoIntegration.ts`) rather than bolting credentials onto the generic
 * `lp_integrations` provider row. HubSpot authenticates with a per-tenant
 * PRIVATE APP access token (a long-lived bearer token the customer pastes in),
 * so — like Marketo's client-credentials — there is NO user-facing OAuth
 * redirect, no refresh token, and no app-level secret. The token never expires
 * on its own, so (unlike Marketo) there is no `token_expires_at` / refresh.
 *
 * SYSTEM-OF-RECORD: Salesforce wins for shared fields whenever a contact has a
 * Salesforce id. HubSpot only writes engagement-specific fields (scores,
 * activity, list membership) into contact metadata.
 *
 * Every table carries a `tenant_id NOT NULL` FK (ON DELETE CASCADE) + index
 * from the first migration — there is no cross-tenant connection fallback.
 */

/**
 * HubSpot Connection — one row per (tenant, portal) pair. Each tenant can
 * connect their own HubSpot account with a private-app token.
 */
export const hubspotConnectionsTable = pgTable("hubspot_connections", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  portalId: text("portal_id").notNull(),                 // HubSpot account/portal id (hub id)
  accessToken: text("access_token").notNull(),           // private-app token, encrypted at rest via encryptCredential() (v1: envelope); read paths decrypt via decryptCredential()
  status: text("status").notNull().default("connected"), // connected | disconnected | error
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  lastSyncError: text("last_sync_error"),
  syncEnabled: boolean("sync_enabled").notNull().default(true),
  importUnlinkedLeads: boolean("import_unlinked_leads").notNull().default(false),
  enrollListId: text("enroll_list_id"),                  // HubSpot (ILS) list id new LP form leads are enrolled into
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  tenantIdx: index("idx_hubspot_connections_tenant_id").on(t.tenantId),
  tenantPortalUnique: unique("uq_hubspot_connections_tenant_portal").on(t.tenantId, t.portalId),
}));

export const insertHubspotConnectionSchema = createInsertSchema(hubspotConnectionsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertHubspotConnection = z.infer<typeof insertHubspotConnectionSchema>;
export type HubspotConnection = typeof hubspotConnectionsTable.$inferSelect;

/**
 * HubSpot Field Mappings — configurable mapping between HubSpot contact
 * properties and LP Studio tables. `direction` controls whether the mapping
 * applies to inbound import, outbound push, or both.
 */
export const hubspotFieldMappingsTable = pgTable("hubspot_field_mappings", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  connectionId: integer("connection_id").notNull().references(() => hubspotConnectionsTable.id, { onDelete: "cascade" }),
  hubspotProperty: text("hubspot_property").notNull(),   // HubSpot contact property internal name, e.g. "email", "hs_lead_status"
  localTable: text("local_table").notNull(),             // sales_accounts | sales_contacts | sales_signals
  localField: text("local_field").notNull(),             // e.g. "email", "metadata.leadScore"
  direction: text("direction").notNull().default("both"), // inbound | outbound | both
  isActive: boolean("is_active").notNull().default(true),
  transformFn: text("transform_fn"),                     // optional whitelisted transform name
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index("idx_hubspot_field_mappings_tenant_id").on(t.tenantId),
  connectionIdx: index("idx_hubspot_field_mappings_connection_id").on(t.connectionId),
}));

export const insertHubspotFieldMappingSchema = createInsertSchema(hubspotFieldMappingsTable).omit({
  id: true, createdAt: true,
});
export type InsertHubspotFieldMapping = z.infer<typeof insertHubspotFieldMappingSchema>;
export type HubspotFieldMapping = typeof hubspotFieldMappingsTable.$inferSelect;

/**
 * HubSpot Sync Log — per-run audit trail. `lastCursor` persists HubSpot's
 * paging `after` token so a partial run can resume from where it left off.
 */
export const hubspotSyncLogTable = pgTable("hubspot_sync_log", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  connectionId: integer("connection_id").notNull().references(() => hubspotConnectionsTable.id, { onDelete: "cascade" }),
  syncType: text("sync_type").notNull(),                 // full | incremental | manual | scheduled
  objectType: text("object_type").notNull(),             // contacts | lists | properties | activities
  recordsProcessed: integer("records_processed").default(0),
  recordsCreated: integer("records_created").default(0),
  recordsUpdated: integer("records_updated").default(0),
  recordsSkipped: integer("records_skipped").default(0),
  status: text("status").notNull().default("running"),   // running | completed | failed
  errorMessage: text("error_message"),
  lastCursor: text("last_cursor"),                       // HubSpot paging `after` token for resumable pagination
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (t) => ({
  tenantIdx: index("idx_hubspot_sync_log_tenant_id").on(t.tenantId),
  connectionIdx: index("idx_hubspot_sync_log_connection_id").on(t.connectionId),
}));

export type HubspotSyncLog = typeof hubspotSyncLogTable.$inferSelect;

/**
 * HubSpot Lists — cached static/active lists available to map. Refreshed on
 * discovery to avoid hammering the API each time the settings page loads.
 */
export const hubspotListsTable = pgTable("hubspot_lists", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  connectionId: integer("connection_id").notNull().references(() => hubspotConnectionsTable.id, { onDelete: "cascade" }),
  hubspotId: text("hubspot_id").notNull(),               // HubSpot list id (ILS list id)
  listType: text("list_type").notNull(),                 // static | dynamic
  name: text("name").notNull(),
  description: text("description"),
  metadata: jsonb("metadata").default({}),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index("idx_hubspot_lists_tenant_id").on(t.tenantId),
  connectionIdx: index("idx_hubspot_lists_connection_id").on(t.connectionId),
  connectionListUnique: unique("uq_hubspot_lists_connection_hubspot_id").on(t.connectionId, t.hubspotId, t.listType),
}));

export type HubspotList = typeof hubspotListsTable.$inferSelect;

/**
 * HubSpot Activities Pushed — idempotency ledger for outbound activity writes.
 * Before pushing an activity for a local event we check for an existing row;
 * after a successful push we record the returned HubSpot object id. This
 * refuses to push the same activity twice on retry.
 */
export const hubspotActivitiesPushedTable = pgTable("hubspot_activities_pushed", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  connectionId: integer("connection_id").notNull().references(() => hubspotConnectionsTable.id, { onDelete: "cascade" }),
  localEventId: text("local_event_id").notNull(),        // local idempotency key (e.g. "email_sent:<signalId>")
  eventType: text("event_type").notNull(),               // email_sent | microsite_view | engagement_score | form_lead
  hubspotActivityId: text("hubspot_activity_id"),        // id returned by HubSpot (nullable in fake/dev mode)
  pushedAt: timestamp("pushed_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index("idx_hubspot_activities_pushed_tenant_id").on(t.tenantId),
  connectionIdx: index("idx_hubspot_activities_pushed_connection_id").on(t.connectionId),
  connectionEventUnique: unique("uq_hubspot_activities_pushed_connection_event").on(t.connectionId, t.localEventId),
}));

export type HubspotActivityPushed = typeof hubspotActivitiesPushedTable.$inferSelect;
