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

/**
 * generator_presets — admin-configurable quick-start options inside the
 * generators (June 2026).
 *
 * A preset is one curated option a user can pick to seed a generation:
 *   • MARKETING — the landing-page generator's "starter chips" (each prefills
 *     a `promptSkeleton` into the prompt box). Previously hardcoded in
 *     StarterPromptChips.tsx and hidden behind MARKETING_STARTER_CHIPS_ENABLED.
 *   • SALES — the microsite generator's "objective cards" (each maps to a
 *     `objective` = MicrositeObjective enum value). Previously hardcoded in
 *     micrositeFlow.OBJECTIVE_CARDS.
 *
 * GLOBAL vs TENANT (mirrors the global-template + per-tenant-visibility model):
 *   • tenant_id NULL  → GLOBAL preset (superadmin-managed default; every tenant
 *     sees it unless they override-hide it).
 *   • tenant_id set   → a TENANT-SPECIFIC preset that only that tenant sees.
 * A tenant's OVERRIDE of a GLOBAL preset (hide / reorder / re-label / re-tie)
 * lives in `generator_preset_overrides`, so the shared global row is never
 * mutated by a tenant and one tenant's edits never leak to another.
 *
 * TEMPLATE TIE: `tiedTemplateSlug` / `tiedTemplateIntent` reuse the EXISTING
 * eligibility/intent system (template-eligibility.ts). A tie is a recommendation
 * INPUT only; selectEligibleTemplate still gates whether the template surfaces.
 * NULL on both = "no template / AI from scratch".
 */
export const generatorPresetsTable = pgTable(
  "generator_presets",
  {
    id: serial("id").primaryKey(),
    // NULL = global; set = tenant-specific.
    tenantId: integer("tenant_id").references(() => tenantsTable.id, {
      onDelete: "cascade",
    }),
    // 'marketing' | 'sales' | 'both'
    surface: text("surface").notNull().default("marketing"),
    label: text("label").notNull().default(""),
    description: text("description"),
    icon: text("icon"),
    promptSkeleton: text("prompt_skeleton"),
    objective: text("objective"),
    tiedTemplateSlug: text("tied_template_slug"),
    tiedTemplateIntent: text("tied_template_intent"),
    enabled: boolean("enabled").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    surfaceTenantIdx: index("generator_presets_surface_tenant_idx").on(
      t.surface,
      t.tenantId,
      t.sortOrder,
    ),
    tenantIdx: index("generator_presets_tenant_idx").on(t.tenantId),
  }),
);

/**
 * generator_preset_overrides — a tenant's per-preset override of a GLOBAL
 * generator_presets row. One row per (tenant_id, global_preset_id). Each
 * override column is NULL = "inherit the global value", so a tenant can hide
 * (enabled=false), reorder (sortOrder), and/or re-skin + re-tie a global preset
 * without touching the shared row.
 */
export const generatorPresetOverridesTable = pgTable(
  "generator_preset_overrides",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenantsTable.id, { onDelete: "cascade" }),
    globalPresetId: integer("global_preset_id")
      .notNull()
      .references(() => generatorPresetsTable.id, { onDelete: "cascade" }),
    // NULL = inherit the global enabled flag.
    enabled: boolean("enabled"),
    // NULL = inherit the global sort order.
    sortOrder: integer("sort_order"),
    label: text("label"),
    description: text("description"),
    icon: text("icon"),
    promptSkeleton: text("prompt_skeleton"),
    objective: text("objective"),
    tiedTemplateSlug: text("tied_template_slug"),
    tiedTemplateIntent: text("tied_template_intent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantGlobalUnique: uniqueIndex(
      "generator_preset_overrides_tenant_global_unique",
    ).on(t.tenantId, t.globalPresetId),
    tenantIdx: index("generator_preset_overrides_tenant_idx").on(t.tenantId),
  }),
);

export type GeneratorPresetRow = typeof generatorPresetsTable.$inferSelect;
export type GeneratorPresetOverrideRow =
  typeof generatorPresetOverridesTable.$inferSelect;
