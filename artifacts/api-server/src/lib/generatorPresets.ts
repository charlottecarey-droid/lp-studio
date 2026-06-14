// Generator presets — effective-preset MERGE + surface filtering + template-tie
// resolution (June 2026).
//
// PRINCIPLE: GLOBAL presets (superadmin defaults, tenant_id NULL) are merged
// with a tenant's PER-PRESET OVERRIDES and the tenant's OWN presets to produce
// the EFFECTIVE list a generator surface renders. Mirrors the global-template +
// per-tenant-visibility pattern: the shared global row is never mutated by a
// tenant; a tenant can hide/reorder/re-skin/re-tie a global preset via an
// override row, and add its own tenant-specific presets.
//
// Design constraints (mirror template-eligibility.ts):
//   • PURE + deterministic: NO DB, NO IO. The route loads the rows and calls
//     this; the same inputs always yield the same effective list. Fully
//     unit-testable.
//   • FAIL-OPEN: a missing override inherits the global value; a missing/empty
//     config yields an empty effective list (the generators fall back to their
//     safe built-in state — marketing renders nothing, sales uses the built-in
//     objectives).
//   • Surface filter: 'both' presets match either generator surface.
//   • Template tie is RESOLVED here only as data (slug/intent passthrough); the
//     actual gating reuses selectEligibleTemplate downstream — see
//     resolvePresetTemplateTie.

export type PresetSurface = "marketing" | "sales" | "both";
export const PRESET_SURFACES: readonly PresetSurface[] = ["marketing", "sales", "both"] as const;

/** Coerce an arbitrary stored value into a valid surface, defaulting to
 *  "marketing" (the safest non-sales surface). */
export function normalizeSurface(value: unknown): PresetSurface {
  return PRESET_SURFACES.includes(value as PresetSurface)
    ? (value as PresetSurface)
    : "marketing";
}

/** True when a preset declared for `presetSurface` should appear on the
 *  generator surface `target`. 'both' matches either; otherwise exact match. */
export function surfaceMatches(presetSurface: PresetSurface, target: "marketing" | "sales"): boolean {
  return presetSurface === "both" || presetSurface === target;
}

/** A canonical preset row (global = tenantId null, or tenant-specific). */
export interface PresetRow {
  id: number;
  tenantId: number | null;
  surface: string;
  label: string;
  description: string | null;
  icon: string | null;
  promptSkeleton: string | null;
  objective: string | null;
  tiedTemplateSlug: string | null;
  tiedTemplateIntent: string | null;
  enabled: boolean;
  sortOrder: number;
}

/** A tenant's per-preset override of a GLOBAL preset. NULL column = inherit. */
export interface PresetOverrideRow {
  globalPresetId: number;
  enabled: boolean | null;
  sortOrder: number | null;
  label: string | null;
  description: string | null;
  icon: string | null;
  promptSkeleton: string | null;
  objective: string | null;
  tiedTemplateSlug: string | null;
  tiedTemplateIntent: string | null;
}

/** The EFFECTIVE preset a generator renders. */
export interface EffectivePreset {
  /** Stable key for the FE: "g<globalId>" for a (possibly overridden) global
   *  preset, "t<tenantPresetId>" for a tenant-specific one. */
  key: string;
  /** The underlying global preset id (when this is a global/overridden-global
   *  preset), else null. */
  globalPresetId: number | null;
  /** The tenant-specific preset id (when tenant-owned), else null. */
  tenantPresetId: number | null;
  scope: "global" | "tenant";
  /** True when a tenant override is in effect on a global preset. */
  overridden: boolean;
  surface: PresetSurface;
  label: string;
  description: string | null;
  icon: string | null;
  promptSkeleton: string | null;
  objective: string | null;
  tiedTemplateSlug: string | null;
  tiedTemplateIntent: string | null;
  enabled: boolean;
  sortOrder: number;
}

/** Inherit helper: prefer the override value when it is non-null, else global. */
function inherit<T>(overrideValue: T | null | undefined, globalValue: T): T {
  return overrideValue === null || overrideValue === undefined ? globalValue : overrideValue;
}

/**
 * Merge GLOBAL presets + a tenant's overrides + the tenant's OWN presets into
 * the effective list for one generator surface.
 *
 *   1. For each GLOBAL preset (tenantId null) on the surface, apply the tenant's
 *      override (if any): inherit each field unless the override sets it.
 *   2. Add the tenant's OWN presets (tenantId === tenantId) on the surface.
 *   3. Sort by effective sortOrder (stable tie-break by label then key).
 *
 * `onlyEnabled` filters out hidden presets (used for the generator-facing read);
 * pass false for management views that need to show disabled rows too.
 *
 * Fail-open: an empty `globals`+`tenantOwn` yields []. A tenant override that
 * points at a global preset not on this surface is ignored.
 */
export function mergeEffectivePresets(args: {
  globals: PresetRow[];
  tenantOwn: PresetRow[];
  overrides: PresetOverrideRow[];
  surface: "marketing" | "sales";
  onlyEnabled: boolean;
}): EffectivePreset[] {
  const { globals, tenantOwn, overrides, surface, onlyEnabled } = args;
  const overrideByGlobalId = new Map<number, PresetOverrideRow>();
  for (const o of overrides) overrideByGlobalId.set(o.globalPresetId, o);

  const out: EffectivePreset[] = [];

  // 1) Global presets (with tenant override applied).
  for (const g of globals) {
    const gs = normalizeSurface(g.surface);
    if (!surfaceMatches(gs, surface)) continue;
    const ov = overrideByGlobalId.get(g.id);
    const enabled = inherit(ov?.enabled, g.enabled);
    if (onlyEnabled && !enabled) continue;
    out.push({
      key: `g${g.id}`,
      globalPresetId: g.id,
      tenantPresetId: null,
      scope: "global",
      overridden: !!ov,
      surface: gs,
      label: inherit(ov?.label, g.label),
      description: inherit(ov?.description ?? null, g.description),
      icon: inherit(ov?.icon ?? null, g.icon),
      promptSkeleton: inherit(ov?.promptSkeleton ?? null, g.promptSkeleton),
      objective: inherit(ov?.objective ?? null, g.objective),
      tiedTemplateSlug: inherit(ov?.tiedTemplateSlug ?? null, g.tiedTemplateSlug),
      tiedTemplateIntent: inherit(ov?.tiedTemplateIntent ?? null, g.tiedTemplateIntent),
      enabled,
      sortOrder: inherit(ov?.sortOrder, g.sortOrder),
    });
  }

  // 2) Tenant-specific presets.
  for (const t of tenantOwn) {
    const ts = normalizeSurface(t.surface);
    if (!surfaceMatches(ts, surface)) continue;
    if (onlyEnabled && !t.enabled) continue;
    out.push({
      key: `t${t.id}`,
      globalPresetId: null,
      tenantPresetId: t.id,
      scope: "tenant",
      overridden: false,
      surface: ts,
      label: t.label,
      description: t.description,
      icon: t.icon,
      promptSkeleton: t.promptSkeleton,
      objective: t.objective,
      tiedTemplateSlug: t.tiedTemplateSlug,
      tiedTemplateIntent: t.tiedTemplateIntent,
      enabled: t.enabled,
      sortOrder: t.sortOrder,
    });
  }

  // 3) Deterministic order: sortOrder asc, then label, then key.
  out.sort(
    (a, b) =>
      a.sortOrder - b.sortOrder ||
      a.label.localeCompare(b.label) ||
      a.key.localeCompare(b.key),
  );
  return out;
}
