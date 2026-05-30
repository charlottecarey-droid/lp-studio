import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { BLOCK_REGISTRY } from "@/lib/block-types";
import {
  neutralizeLabel,
  resolveBlocksForIndustry,
  type CatalogEntry,
  type ResolvedBlockDef,
} from "@/lib/block-catalog-merge";

// Re-export for existing callers that import these from the hook module.
export { neutralizeLabel };
export type { CatalogEntry, ResolvedBlockDef };

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
 * Resolve the visible block list for the current tenant's industry. The pure
 * merge logic lives in `@/lib/block-catalog-merge` (so it can be unit-tested
 * without React); this hook just owns the fetch + loading/error state.
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

  const blocks = useMemo<ResolvedBlockDef[]>(
    () => resolveBlocksForIndustry(rows, industry),
    [rows, industry],
  );

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
