import { pgTable, text, serial, timestamp, jsonb, integer, boolean, unique } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";

/**
 * lp_integrations — the generic per-tenant "lead delivery" provider store
 * (google_sheets, asana, webhook). One row per (tenant, provider); `config`
 * is a provider-shaped JSONB blob whose credential fields are encrypted at
 * rest via encryptConfigCredentials() (the CREDENTIAL_FIELDS_BY_PROVIDER
 * whitelist in api-server's lib/encryption.ts) and decrypted on every read.
 *
 * Declared here (settings consolidation Phase 4) so the schemaDrift guard
 * covers the table — it predates the Drizzle schema and was raw-SQL-only for
 * its whole life. Access goes through api-server's lib/lpIntegrationsStore.ts.
 *
 * Retired providers, purged from live data and no longer readable/writable:
 *   - 'salesforce' (migration 0088 — OAuth unified onto sfdc_connections)
 *   - 'marketo'    (migration 0119 — unified onto marketo_connections)
 *
 * The tenants FK deliberately has NO ON DELETE clause — that matches prod's
 * constraint exactly (see migration 0071); tenant deletion clears rows
 * explicitly in routes/admin.ts.
 */
export const lpIntegrationsTable = pgTable("lp_integrations", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull(),
  config: jsonb("config").notNull().default({}),
  enabled: boolean("enabled").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
}, (t) => ({
  tenantProviderUnique: unique("lp_integrations_tenant_provider_key").on(t.tenantId, t.provider),
}));

export type LpIntegration = typeof lpIntegrationsTable.$inferSelect;
