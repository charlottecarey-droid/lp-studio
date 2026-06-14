import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";
import { lpPagesTable } from "./lpPages";

/**
 * lp_microsite_template_overrides — a tenant's per-template override of a GLOBAL
 * (shared) template's create-microsite-dropdown settings.
 *
 * Owned templates (isGlobal=false) carry their dropdown state directly on the
 * lp_pages row (micrositeEnabled, templateLabel). GLOBAL flagship / business-case
 * templates are shared across every tenant, so a tenant cannot toggle or rename
 * them without leaking the change to all tenants. This table holds those
 * per-tenant edits instead. One row per (tenant_id, template_id):
 *   • enabled NULL → inherit the computed compatibility default.
 *   • enabled true/false → tenant force-show / force-hide in the dropdown.
 *   • label  NULL → inherit the template's own label/title.
 *   • label  set  → the name THIS tenant's reps see in the dropdown.
 * The shared lp_pages row is never mutated, so one tenant's edits never leak to
 * another.
 */
export const micrositeTemplateOverridesTable = pgTable(
  "lp_microsite_template_overrides",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenantsTable.id, { onDelete: "cascade" }),
    templateId: integer("template_id")
      .notNull()
      .references(() => lpPagesTable.id, { onDelete: "cascade" }),
    // NULL = inherit the computed compatibility default.
    enabled: boolean("enabled"),
    // NULL = inherit the template's own label/title.
    label: text("label"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    tenantTemplateUnique: uniqueIndex(
      "lp_microsite_template_overrides_tenant_template_unique",
    ).on(t.tenantId, t.templateId),
    tenantIdx: index("lp_microsite_template_overrides_tenant_idx").on(
      t.tenantId,
    ),
  }),
);

export type MicrositeTemplateOverrideRow =
  typeof micrositeTemplateOverridesTable.$inferSelect;
