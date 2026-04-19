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
  const industry: "dental" | "generic" = user?.tenantIndustry ?? "dental";
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
        setRows([]);
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
        label: def.label,
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

    // generic with no rows yet (initial render or empty result): fall back to
    // BLOCK_REGISTRY so the builder is never blank. Once admin populates the
    // generic catalog, only catalog rows are shown.
    if (catalogByType.size === 0) {
      return BLOCK_REGISTRY.map(def => ({
        type: def.type,
        label: def.label,
        category: def.category,
        defaultProps: def.defaultProps,
        sortOrder: 0,
        source: "registry" as const,
      }));
    }

    // generic: only catalog rows are visible
    const out: ResolvedBlockDef[] = [];
    for (const cat of catalogByType.values()) {
      const reg = BLOCK_REGISTRY.find(b => b.type === cat.blockType);
      out.push({
        type: cat.blockType,
        label: cat.label || reg?.label || cat.blockType,
        category: (cat.category as BlockCategory) || reg?.category || ("Content" as BlockCategory),
        defaultProps: reg
          ? () => ({ ...reg.defaultProps(), ...cat.defaultProps })
          : () => ({ ...cat.defaultProps }),
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
      label: reg.label,
      category: reg.category,
      defaultProps: reg.defaultProps,
      sortOrder: 0,
      source: "registry",
    };
  };

  return { industry, blocks, getDef, loading, error };
}
