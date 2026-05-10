import { pgTable, text, serial, timestamp, integer, uniqueIndex, index } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";

/**
 * Per-tenant webhook secrets — task #147.
 *
 * Inbound webhook URLs (`/webhooks/rb2b/:secret`, `/apollo/:secret`,
 * `/letterdrop/:secret`) embed a per-tenant secret so the handler can
 * resolve which tenant the incoming signal belongs to. Unknown secrets
 * return 404 with no body so an attacker can't probe which integrations
 * a tenant has configured.
 *
 * Secrets are generated with `crypto.randomBytes(24).toString("base64url")`
 * (~192 bits of entropy) and are unique across the table — there is no
 * scenario where two tenants share the same webhook URL.
 */
export const tenantWebhookSecretsTable = pgTable("tenant_webhook_secrets", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenantsTable.id, { onDelete: "cascade" }),
  // 'rb2b' | 'apollo' | 'letterdrop'. Stored as free-form text (not a PG
  // enum) so adding a fourth provider is a code-only change.
  integration: text("integration").notNull(),
  secret: text("secret").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  // One secret per (tenant, integration). Rotating means DELETE then INSERT.
  uniqueIndex("tenant_webhook_secrets_tenant_integration_idx").on(t.tenantId, t.integration),
  // Fast lookup by secret in the webhook handler hot path.
  index("tenant_webhook_secrets_secret_idx").on(t.secret),
]);

export type TenantWebhookSecret = typeof tenantWebhookSecretsTable.$inferSelect;
export type InsertTenantWebhookSecret = typeof tenantWebhookSecretsTable.$inferInsert;
