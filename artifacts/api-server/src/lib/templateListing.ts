import { db, lpPagesTable, micrositeTemplateOverridesTable } from "@workspace/db";
import { and, asc, eq, or, sql } from "drizzle-orm";
import { getMicrositeTemplateCompatibility } from "@workspace/lp-template-engine";

// Shared template-listing logic for GET /lp/templates AND the Salesforce
// microsite-button choice sync (Task #1448). Extracted from routes/lp/pages.ts
// so the Salesforce dropdown can never drift from the in-app create-microsite
// dropdown — both consume the exact same visibility + forMicrosite filter.
//
// Semantics (unchanged from the route):
//   - ownedOnly: tenant-owned templates only (is_global=false guard is
//     defensive so a tenant template flagged global can't leak into the
//     sales-rep microsite generator's tenant-only picker).
//   - salesMode: tenant-owned templates PLUS the global "business-case"
//     flagship templates (first block type starts with "business-case") and
//     the is_all_in_one framework monographs. The full off-brand global
//     starter library stays excluded.
//   - forMicrosite: restrict to templates effectively enabled for the
//     create-microsite dropdown (explicit override wins, else the computed
//     compatibility default). Built-in (global) rows read the tenant's
//     enable/rename overrides from lp_microsite_template_overrides; owned
//     rows use their own columns.

export interface TemplateListingOpts {
  ownedOnly?: boolean;
  salesMode?: boolean;
  forMicrosite?: boolean;
}

export async function listTemplatesForTenant(
  tenantId: number,
  opts: TemplateListingOpts = {},
): Promise<Array<typeof lpPagesTable.$inferSelect>> {
  const { ownedOnly = false, salesMode = false, forMicrosite = false } = opts;

  // The first block's type — business-case templates are single-block
  // "monograph" documents whose first (only) block is business-case-*.
  const isBusinessCaseGlobal = and(
    eq(lpPagesTable.isGlobal, true),
    sql`(${lpPagesTable.blocks} -> 0 ->> 'type') LIKE 'business-case%'`,
  );
  // Global all-in-one flagship/framework templates — single-block monograph
  // documents the rep microsite generator is meant to use (the StoryBrand /
  // MEDDIC exec-decision-brief / Challenger framework pages, plus the
  // business-case all-in-ones). is_all_in_one is the canonical flag for these
  // curated, structure-locked layouts.
  const isFlagshipGlobal = and(
    eq(lpPagesTable.isGlobal, true),
    eq(lpPagesTable.isAllInOne, true),
  );
  const ownedTemplates = and(
    eq(lpPagesTable.tenantId, tenantId),
    eq(lpPagesTable.isGlobal, false),
  );
  const visibility = salesMode
    ? or(ownedTemplates, isBusinessCaseGlobal, isFlagshipGlobal)
    : ownedOnly
      ? ownedTemplates
      : or(
          eq(lpPagesTable.tenantId, tenantId),
          eq(lpPagesTable.isGlobal, true),
        );
  const templates = await db
    .select()
    .from(lpPagesTable)
    .where(
      and(
        eq(lpPagesTable.isTemplate, true),
        visibility,
      ),
    )
    .orderBy(asc(lpPagesTable.templateLabel));

  // Built-in (global) templates are shared rows, so a tenant's enable/hide +
  // rename of them lives in lp_microsite_template_overrides. Owned templates
  // keep using their own row columns. Fetch the tenant's overrides only when
  // global rows are actually present in the result.
  const hasGlobals = templates.some((t) => t.isGlobal);
  const overrideByTemplateId = hasGlobals
    ? new Map(
        (
          await db
            .select()
            .from(micrositeTemplateOverridesTable)
            .where(eq(micrositeTemplateOverridesTable.tenantId, tenantId))
        ).map((o) => [o.templateId, o]),
      )
    : new Map<number, { enabled: boolean | null; label: string | null }>();

  // Overlay a tenant's per-tenant rename of a built-in template so every
  // consumer shows the marketing-chosen name (applies regardless of
  // forMicrosite).
  const withOverrides = templates.map((t) => {
    if (!t.isGlobal) return t;
    const ov = overrideByTemplateId.get(t.id);
    return ov?.label ? { ...t, templateLabel: ov.label } : t;
  });

  if (!forMicrosite) return withOverrides;

  return withOverrides.filter((t) => {
    // Built-in template: tenant override wins, else compatibility default.
    if (t.isGlobal) {
      const ov = overrideByTemplateId.get(t.id);
      if (typeof ov?.enabled === "boolean") return ov.enabled;
      const blocks = Array.isArray(t.blocks) ? t.blocks : [];
      return getMicrositeTemplateCompatibility(
        blocks as ReadonlyArray<{ type?: unknown }>,
      ).compatible;
    }
    // Owned template: explicit row override, else compatibility default.
    if (typeof t.micrositeEnabled === "boolean") return t.micrositeEnabled;
    const blocks = Array.isArray(t.blocks) ? t.blocks : [];
    return getMicrositeTemplateCompatibility(
      blocks as ReadonlyArray<{ type?: unknown }>,
    ).compatible;
  });
}
