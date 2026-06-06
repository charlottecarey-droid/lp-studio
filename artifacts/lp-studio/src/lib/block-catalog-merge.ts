import { BLOCK_REGISTRY } from "./block-types";
import type { BlockCategory } from "./block-types";
import { getDefaultBlockTags, type BlockRoleTag } from "@workspace/lp-template-engine";

export type Industry = "dental" | "generic";

/**
 * Industries the superadmin block catalog spans. The merged superadmin view
 * shows one row per (BLOCK_REGISTRY block × industry).
 */
export const INDUSTRIES: Industry[] = ["generic", "dental"];

/**
 * Strip "Dandy"/"DSO" tokens from a block label so non-Dandy tenants never see
 * those words anywhere in the builder UI. Used as a last-resort cleanup for
 * block defs that fall back to BLOCK_REGISTRY (whose labels intentionally say
 * "Dandy ...", "DSO ...", "Inside Dandy · ..." for the dental industry).
 */
export function neutralizeLabel(label: string): string {
  if (!label) return label;
  const out = label
    .replace(/^Inside\s+Dandy\s*[·:\-–—]\s*/i, "")
    .replace(/^Dandy\s*[:\-–—]\s*/i, "")
    .replace(/^Dandy\s+/i, "")
    .replace(/^DSO\s+/i, "")
    .replace(/\s*\((?:[^()]*\b(?:Dandy|DSO)\b[^()]*)\)\s*$/i, "")
    .replace(/\s+\b(?:Dandy|DSO)\b\s*$/i, "")
    .replace(/\b(?:Dandy|DSO)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([:·–—])\s*/g, " $1 ")
    .trim();
  // If the cleanup left an empty string, fall back to the original so we
  // never render a blank label in the inspector.
  return out || label;
}

// ─── Builder resolution (use-block-catalog) ─────────────────────────────────

export interface CatalogEntry {
  blockType: string;
  industry: Industry;
  label: string;
  category: BlockCategory | string;
  defaultProps: Record<string, unknown>;
  sortOrder: number;
  isEnabled: boolean;
}

export interface ResolvedBlockDef {
  type: string;
  label: string;
  category: BlockCategory;
  defaultProps: () => Record<string, unknown>;
  sortOrder: number;
  source: "registry" | "catalog";
}

/**
 * Resolve the visible block list for the current tenant's industry.
 *
 * - dental:  show all BLOCK_REGISTRY entries; if a catalog row exists for that
 *            block_type, its `defaultProps` partial is shallow-merged on top of
 *            the in-code defaults and its label/category override.
 * - generic: show ALL BLOCK_REGISTRY entries (Dandy/DSO tokens stripped from
 *            labels) so non-Dandy tenants get the full palette. Catalog rows
 *            override label/category/sortOrder/defaultProps for the same
 *            blockType; an explicit `isEnabled: false` row hides a block.
 *            Catalog rows referencing a custom blockType not in BLOCK_REGISTRY
 *            are still surfaced.
 *
 * Returns the in-code BLOCK_REGISTRY unchanged when `rows` is null (still
 * loading or fetch error) so the builder is never left empty.
 */
export function resolveBlocksForIndustry(
  rows: CatalogEntry[] | null,
  industry: Industry,
): ResolvedBlockDef[] {
  const catalogByType = new Map<string, CatalogEntry>();
  (rows ?? []).filter(r => r.isEnabled !== false).forEach(r => catalogByType.set(r.blockType, r));

  // Fallback while loading or on fetch error: never leave the builder empty.
  // Always show the in-code BLOCK_REGISTRY so the editor is usable even if
  // the catalog API is down. Catalog filtering kicks in only once rows have
  // been received (rows !== null).
  if (rows === null) {
    return BLOCK_REGISTRY.map(def => ({
      type: def.type,
      label: industry === "generic" ? neutralizeLabel(def.label) : def.label,
      category: def.category,
      defaultProps: def.defaultProps,
      sortOrder: 0,
      source: "registry" as const,
    }));
  }

  if (industry === "dental") {
    // All registry blocks visible; catalog rows override
    return BLOCK_REGISTRY.map(def => {
      const cat = catalogByType.get(def.type);
      if (!cat) {
        return {
          type: def.type,
          label: def.label,
          category: def.category,
          defaultProps: def.defaultProps,
          sortOrder: 0,
          source: "registry" as const,
        };
      }
      return {
        type: def.type,
        label: cat.label || def.label,
        category: (cat.category as BlockCategory) || def.category,
        defaultProps: () => ({ ...def.defaultProps(), ...cat.defaultProps }),
        sortOrder: cat.sortOrder ?? 0,
        source: "catalog" as const,
      };
    });
  }

  // generic: show ALL BLOCK_REGISTRY entries (with Dandy/DSO tokens stripped
  // from labels via `neutralizeLabel`) so non-Dandy tenants get the full
  // palette — matching what the AI is allowed to generate. Catalog rows
  // override label/category/sortOrder/defaultProps for the same blockType,
  // and an explicit `isEnabled: false` row hides a block. Catalog rows that
  // reference a custom blockType not in BLOCK_REGISTRY are still surfaced.
  // Build the disabled set from the raw rows BEFORE filtering by isEnabled.
  const disabledTypes = new Set(
    (rows ?? []).filter(r => r.isEnabled === false).map(r => r.blockType),
  );
  const out: ResolvedBlockDef[] = [];
  const seenTypes = new Set<string>();
  for (const def of BLOCK_REGISTRY) {
    if (disabledTypes.has(def.type)) continue;
    seenTypes.add(def.type);
    const cat = catalogByType.get(def.type);
    const rawLabel = cat?.label || def.label;
    out.push({
      type: def.type,
      label: neutralizeLabel(rawLabel),
      category: ((cat?.category as BlockCategory) || def.category),
      defaultProps: cat
        ? () => ({ ...def.defaultProps(), ...cat.defaultProps })
        : def.defaultProps,
      sortOrder: cat?.sortOrder ?? 0,
      source: cat ? ("catalog" as const) : ("registry" as const),
    });
  }
  // Custom catalog-only rows (no in-code registry entry).
  for (const cat of catalogByType.values()) {
    if (seenTypes.has(cat.blockType)) continue;
    out.push({
      type: cat.blockType,
      label: neutralizeLabel(cat.label || cat.blockType),
      category: (cat.category as BlockCategory) || ("Content" as BlockCategory),
      defaultProps: () => ({ ...cat.defaultProps }),
      sortOrder: cat.sortOrder ?? 0,
      source: "catalog" as const,
    });
  }
  out.sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
  return out;
}

/**
 * Compute the *effective* default props for a catalog row exactly as a tenant in
 * that industry would receive them: the in-code BLOCK_REGISTRY default, shallow-
 * merged under the row's stored override (`source: "db"` rows carry a RAW partial;
 * `source: "code"` rows already carry the full registry default, so the merge is
 * a no-op for them). Mirrors `resolveBlocksForIndustry`'s
 * `{ ...def.defaultProps(), ...row.default_props }` semantics.
 *
 * Used to pre-fill the visual block-default editor (task #1026) so the builder
 * opens showing the block as it actually renders today, not a sparse partial.
 */
export function effectiveDefaultProps(row: {
  block_type: string;
  default_props?: Record<string, unknown> | null;
}): Record<string, unknown> {
  const def = BLOCK_REGISTRY.find(d => d.type === row.block_type);
  let base: Record<string, unknown> = {};
  if (def) {
    try {
      base = def.defaultProps();
    } catch {
      base = {};
    }
  }
  return { ...base, ...(row.default_props ?? {}) };
}

// ─── Superadmin merged catalog (SuperAdminBlockCatalog) ─────────────────────

export interface CatalogRow {
  block_type: string;
  industry: Industry;
  label: string;
  category: string;
  /**
   * Per-industry semantic role-tag override (controlled vocabulary). NULL/empty
   * means no override → the block inherits its in-code default tags. Synthetic
   * "code default" rows are filled with `getDefaultBlockTags(block_type)` so the
   * superadmin always sees the effective tags.
   */
  tags?: BlockRoleTag[] | null;
  default_props: Record<string, unknown>;
  is_enabled: boolean;
  /**
   * Whether the AI page generator may advertise this block to the model.
   * Independent of `is_enabled` (builder-library visibility). Defaults to true
   * (fail-open). Synthetic "code default" rows are filled with `true`.
   */
  ai_enabled: boolean;
  sort_order: number;
  updated_at: string;
  updated_by?: string | null;
}

/**
 * A row as shown in the superadmin table: either a saved database override
 * (`source: "db"` → "Customized") or a synthetic entry derived from the
 * in-code BLOCK_REGISTRY default (`source: "code"` → "Code default") for a
 * block that has no override row in this industry yet.
 */
export type DisplayRow = CatalogRow & { source: "db" | "code" };

/**
 * Merge the in-code BLOCK_REGISTRY with the database override rows so the
 * superadmin sees the FULL set of blocks (one entry per block per industry),
 * not just the rows that happen to have an override. Mirrors the resolution
 * semantics of the builder's `resolveBlocksForIndustry`: a DB row overrides the
 * registry label/category/props ("Customized"); absence of a row means the
 * tenant inherits the in-code default ("Code default").
 *
 * The resulting list always contains BLOCK_REGISTRY.length × INDUSTRIES.length
 * entries, plus one extra entry for every custom DB-only row whose block_type
 * is not present in BLOCK_REGISTRY.
 */
export function mergeSuperadminCatalog(rows: CatalogRow[]): DisplayRow[] {
  const dbByKey = new Map<string, CatalogRow>();
  rows.forEach(r => dbByKey.set(`${r.block_type}::${r.industry}`, r));

  const out: DisplayRow[] = [];
  const seen = new Set<string>();
  for (const industry of INDUSTRIES) {
    for (const def of BLOCK_REGISTRY) {
      const key = `${def.type}::${industry}`;
      seen.add(key);
      const db = dbByKey.get(key);
      if (db) {
        out.push({ ...db, source: "db" });
      } else {
        let defaultProps: Record<string, unknown> = {};
        try {
          defaultProps = def.defaultProps();
        } catch {
          // A malformed registry default must never blank the whole table —
          // surface the block with empty props so it can still be edited.
          defaultProps = {};
        }
        out.push({
          block_type: def.type,
          industry,
          // Generic tenants never see Dandy/DSO tokens in the builder, so
          // surface the neutralized label here too — that's what a new
          // generic tenant actually inherits from the code default.
          label: industry === "generic" ? neutralizeLabel(def.label) : def.label,
          category: def.category,
          // Effective code-default role tags for this block type, so the
          // superadmin sees the tags that actually apply when there's no
          // per-industry DB override.
          tags: getDefaultBlockTags(def.type),
          default_props: defaultProps,
          is_enabled: true,
          ai_enabled: true,
          sort_order: 0,
          updated_at: "",
          updated_by: null,
          source: "code",
        });
      }
    }
  }
  // Custom override rows whose block_type has no in-code registry entry.
  for (const r of rows) {
    if (seen.has(`${r.block_type}::${r.industry}`)) continue;
    out.push({ ...r, source: "db" });
  }
  out.sort((a, b) =>
    a.block_type.localeCompare(b.block_type) ||
    a.industry.localeCompare(b.industry),
  );
  return out;
}
