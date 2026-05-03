import type { ResolvedBlockDef } from "@/hooks/use-block-catalog";
import type { BlockCategory } from "@/lib/block-types";

export interface BlockLibraryPrefs {
  hiddenBlockTypes: string[];
  categoryOrder: string[];
  categoryLabels: Record<string, string>;
  blockOrder: Record<string, string[]>;
  blockOverrides: Record<string, { category?: string; label?: string }>;
}

export const EMPTY_PREFS: BlockLibraryPrefs = {
  hiddenBlockTypes: [],
  categoryOrder: [],
  categoryLabels: {},
  blockOrder: {},
  blockOverrides: {},
};

/**
 * Apply per-tenant block-library preferences on top of the catalog-resolved
 * block list. Returns a new array — never mutates input.
 *
 * - `hiddenBlockTypes` removes blocks entirely from the picker.
 * - `blockOverrides[type].label` renames a block.
 * - `blockOverrides[type].category` re-shelves a block into a different group.
 * - `blockOrder[category]` provides an explicit order for blocks in that group;
 *   any blocks not listed there fall back to (sortOrder, label).
 *
 * The `category` on each returned block reflects any override so consumers
 * that group by `block.category` automatically see the new shelf.
 */
export function applyBlockLibraryPrefs(
  blocks: ResolvedBlockDef[],
  prefs: BlockLibraryPrefs,
): ResolvedBlockDef[] {
  const hidden = new Set(prefs.hiddenBlockTypes);
  const remapped = blocks
    .filter(b => !hidden.has(b.type))
    .map(b => {
      const ov = prefs.blockOverrides[b.type];
      if (!ov) return b;
      return {
        ...b,
        label: ov.label || b.label,
        category: (ov.category as BlockCategory) || b.category,
      };
    });

  // Apply per-category order if present.
  const ordered: ResolvedBlockDef[] = [];
  const consumed = new Set<string>();
  // First pass: bucket by current (post-override) category
  const byCategory = new Map<string, ResolvedBlockDef[]>();
  for (const b of remapped) {
    const arr = byCategory.get(b.category) ?? [];
    arr.push(b);
    byCategory.set(b.category, arr);
  }
  for (const [cat, arr] of byCategory) {
    const explicit = prefs.blockOrder[cat] ?? [];
    if (explicit.length === 0) continue;
    const indexOf = new Map<string, number>();
    explicit.forEach((t, i) => indexOf.set(t, i));
    arr.sort((a, b) => {
      const ai = indexOf.get(a.type);
      const bi = indexOf.get(b.type);
      if (ai !== undefined && bi !== undefined) return ai - bi;
      if (ai !== undefined) return -1;
      if (bi !== undefined) return 1;
      return (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.label.localeCompare(b.label);
    });
  }
  for (const arr of byCategory.values()) {
    for (const b of arr) {
      if (!consumed.has(b.type)) {
        ordered.push(b);
        consumed.add(b.type);
      }
    }
  }
  return ordered;
}

/**
 * Reorder a list of category names according to prefs.categoryOrder.
 * Categories not present in the override order keep their relative order at
 * the end of the list. Categories in the override that don't appear in the
 * input list are dropped (they may have been emptied out).
 */
export function applyCategoryOrder(
  defaultOrder: readonly string[],
  prefs: BlockLibraryPrefs,
): string[] {
  if (!prefs.categoryOrder || prefs.categoryOrder.length === 0) return [...defaultOrder];
  const known = new Set(defaultOrder);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of prefs.categoryOrder) {
    if (known.has(c) && !seen.has(c)) {
      out.push(c);
      seen.add(c);
    }
  }
  for (const c of defaultOrder) {
    if (!seen.has(c)) {
      out.push(c);
      seen.add(c);
    }
  }
  return out;
}

export function categoryLabel(name: string, prefs: BlockLibraryPrefs): string {
  return prefs.categoryLabels[name] || name;
}

/** Case-insensitive substring match against label, type, and category. */
export function matchesSearch(b: ResolvedBlockDef, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    b.label.toLowerCase().includes(q) ||
    b.type.toLowerCase().includes(q) ||
    b.category.toLowerCase().includes(q)
  );
}
