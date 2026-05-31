import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";

/**
 * Per-tenant branded email shell (Task #588) — the wrapper a tenant's own
 * notification emails (lead notifications, comments, review decisions, form
 * follow-ups) are rendered into. One row per tenant, keyed by `tenant_id`.
 *
 * Mirrors `email_shell_templates` (the platform singleton) but is tenant-scoped.
 * Any column left NULL falls back — first to the tenant's brand-derived shell
 * (computed from `lp_brand_settings`), then to the platform code default — so a
 * missing row or a bad edit can never produce a broken (or empty) frame.
 */
export const tenantEmailShellsTable = pgTable("tenant_email_shells", {
  tenantId: integer("tenant_id").primaryKey(),
  // Full raw shell HTML override (null = brand-derived / platform default).
  shellHtml: text("shell_html"),
  // Brand pieces injected into the shell slots (null = brand-derived / default).
  logoHtml: text("logo_html"),
  headerBg: text("header_bg"),
  footerHtml: text("footer_html"),
  // Per-tenant CAN-SPAM postal address injected into the `{{physicalAddress}}`
  // footer token of every tenant email. NULL/empty = the footer omits the
  // address line cleanly (no stray separators).
  physicalAddress: text("physical_address"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  updatedBy: text("updated_by"),
});

export type TenantEmailShell = typeof tenantEmailShellsTable.$inferSelect;
export type InsertTenantEmailShell = typeof tenantEmailShellsTable.$inferInsert;
