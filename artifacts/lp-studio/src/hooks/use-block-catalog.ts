import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { BLOCK_REGISTRY } from "@/lib/block-types";
import type { BlockCategory } from "@/lib/block-types";

/** Raw row shape returned by GET /api/block-catalog (snake_case from pg). */
interface RawCatalogRow {
  block_type: string;
  industry: "dental" | "generic";
  label: string;
  category: string;
  default_props: Record<string, unknown>;
  sort_order: number;
  is_enabled: boolean;
}

export interface CatalogEntry {
  blockType: string;
  industry: "dental" | "generic";
  label: string;
  category: BlockCategory | string;
  defaultProps: Record<string, unknown>;
  sortOrder: number;
  isEnabled: boolean;
}

function normalize(rows: unknown): CatalogEntry[] {
  const arr: RawCatalogRow[] = Array.isArray(rows)
    ? (rows as RawCatalogRow[])
    : Array.isArray((rows as { items?: RawCatalogRow[] })?.items)
      ? (rows as { items: RawCatalogRow[] }).items
      : [];
  return arr.map(r => ({
    blockType: r.block_type,
    industry: r.industry,
    label: r.label,
    category: r.category,
    defaultProps: r.default_props ?? {},
    sortOrder: r.sort_order ?? 0,
    isEnabled: r.is_enabled !== false,
  }));
}

/**
 * Strip "Dandy"/"DSO" tokens from a block label so non-Dandy tenants never see
 * those words anywhere in the builder UI. Used as a last-resort cleanup for
 * block defs that fall back to BLOCK_REGISTRY (whose labels intentionally say
 * "Dandy ...", "DSO ...", "Inside Dandy · ..." for the dental industry).
 */
function neutralizeLabel(label: string): string {
  if (!label) return label;
  let out = label
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
 * - generic: show ONLY blocks that have a catalog row for industry='generic'.
 *            Catalog `defaultProps` partial is shallow-merged on top of the
 *            in-code BLOCK_REGISTRY default for the same block_type. If there
 *            is no in-code default (custom block), use catalog.defaultProps as-is.
 *
 * Returns the in-code BLOCK_REGISTRY unchanged while loading or on error.
 */
export function useBlockCatalog() {
  const { user } = useAuth();
  // Default to "generic" while the user/tenant is still loading or when the
  // server has not (yet) attached an industry. Only an explicit "dental"
  // value should resolve to dental — this keeps non-Dandy tenants safe from
  // ever briefly seeing dental-only blocks.
  const industry: "dental" | "generic" = user?.tenantIndustry === "dental" ? "dental" : "generic";
  const [rows, setRows] = useState<CatalogEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/block-catalog?industry=${encodeURIComponent(industry)}`, { credentials: "include" })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: unknown) => {
        if (cancelled) return;
        setRows(normalize(data));
      })
      .catch(e => {
        if (cancelled) return;
        setError(String(e?.message ?? e));
        setRows(null); // keep null so the hook treats this as "not loaded" → registry fallback
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [industry]);

  const blocks = useMemo<ResolvedBlockDef[]>(() => {
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
  }, [rows, industry]);

  /** Lookup helper that always falls back to BLOCK_REGISTRY so renderers never crash */
  const getDef = (type: string): ResolvedBlockDef | undefined => {
    const hit = blocks.find(b => b.type === type);
    if (hit) return hit;
    const reg = BLOCK_REGISTRY.find(b => b.type === type);
    if (!reg) return undefined;
    return {
      type: reg.type,
      // Strip "Dandy"/"DSO" from registry labels for non-Dandy tenants. This
      // matters for legacy pages that still reference dandy-*/dso-* blocks
      // not present in the generic catalog — the inspector/sidebar would
      // otherwise leak the dental-flavored label text.
      label: industry === "generic" ? neutralizeLabel(reg.label) : reg.label,
      category: reg.category,
      defaultProps: reg.defaultProps,
      sortOrder: 0,
      source: "registry",
    };
  };

  return { industry, blocks, getDef, loading, error };
}
