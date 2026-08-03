import { useCallback, useEffect, useRef, useState } from "react";
import {
  createAudience,
  deleteAudience,
  listAudiences,
  migrateLegacySavedViews,
  updateAudience,
  type Audience,
} from "@/lib/audiences";

/**
 * The Accounts list's saved views, backed by audiences instead of localStorage.
 *
 * Deliberately keeps the shape the pages already render (`{ id, name, filters:
 * { ownerFilters, ... } }`) so swapping the storage layer doesn't mean
 * rewriting the surrounding JSX in two multi-thousand-line files. The mapping
 * between that shape and the stored AudienceFilters lives here and nowhere
 * else.
 *
 * Only audiences defined by ACCOUNT CRITERIA show up as views — an audience of
 * explicitly-picked contacts isn't a filter you can apply to the accounts list,
 * so it stays out of this dropdown while remaining a perfectly good campaign
 * audience.
 */
export interface AccountViewFilters {
  ownerFilters: string[];
  abmTierFilters: string[];
  abmStageFilters: string[];
  segmentFilters: string[];
}

export interface AccountView {
  /** String for drop-in compatibility with the previous localStorage ids. */
  id: string;
  name: string;
  filters: AccountViewFilters;
}

const EMPTY: AccountViewFilters = {
  ownerFilters: [], abmTierFilters: [], abmStageFilters: [], segmentFilters: [],
};

function toView(a: Audience): AccountView {
  const f = a.filters ?? {};
  return {
    id: String(a.id),
    name: a.name,
    filters: {
      ownerFilters: f.owners ?? [],
      abmTierFilters: f.abmTiers ?? [],
      abmStageFilters: f.abmStages ?? [],
      segmentFilters: f.practiceSegments ?? [],
    },
  };
}

/** An audience is showable as an account view when it's criteria-defined and
 *  none of those criteria are contact-level. */
function isAccountView(a: Audience): boolean {
  const f = a.filters ?? {};
  if (f.contactIds?.length || f.accountIds?.length) return false;
  if (f.titleKeywords?.length || f.departments?.length || f.contactRoles?.length
    || f.tiers?.length || f.titleLevels?.length) return false;
  return true;
}

function hasAny(f: AccountViewFilters): boolean {
  return f.ownerFilters.length > 0 || f.abmTierFilters.length > 0
    || f.abmStageFilters.length > 0 || f.segmentFilters.length > 0;
}

export function useAccountAudiences(opts: {
  /** Legacy localStorage key, migrated once then left alone. Null = skip. */
  legacyViewsKey: string | null;
  /** Current filter state from the page. */
  current: AccountViewFilters;
  /** Push a stored view's filters back into the page. */
  onApply: (filters: AccountViewFilters) => void;
}) {
  const { legacyViewsKey, current, onApply } = opts;
  const [views, setViews] = useState<AccountView[]>([]);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [dirtyViewId, setDirtyViewId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const migrated = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const all = await listAudiences().catch(() => [] as Audience[]);
      // One-time lift of this browser's localStorage views. Best-effort: a
      // failure just means the rep re-creates a view, never a broken page.
      if (!migrated.current) {
        migrated.current = true;
        const created = await migrateLegacySavedViews(legacyViewsKey, all).catch(() => [] as Audience[]);
        if (created.length > 0) all.push(...created);
      }
      if (!cancelled) {
        setViews(all.filter(isAccountView).map(toView));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [legacyViewsKey]);

  /** Call when the user edits a filter, so an applied view shows as modified. */
  const markDirty = useCallback(() => {
    setActiveViewId(prev => {
      if (prev) setDirtyViewId(prev);
      return null;
    });
  }, []);

  const saveView = useCallback(async (name: string): Promise<void> => {
    const trimmed = name.trim();
    if (!trimmed || !hasAny(current)) return;
    const created = await createAudience({
      name: trimmed,
      filters: {
        owners: current.ownerFilters,
        abmTiers: current.abmTierFilters,
        abmStages: current.abmStageFilters,
        practiceSegments: current.segmentFilters,
      },
    }).catch(() => null);
    if (!created) return;
    const view = toView(created);
    setViews(prev => [...prev, view]);
    setActiveViewId(view.id);
    setDirtyViewId(null);
  }, [current]);

  const updateViewFilters = useCallback(async (id: string): Promise<void> => {
    const updated = await updateAudience(Number(id), {
      filters: {
        owners: current.ownerFilters,
        abmTiers: current.abmTierFilters,
        abmStages: current.abmStageFilters,
        practiceSegments: current.segmentFilters,
      },
    }).catch(() => null);
    if (!updated) return;
    setViews(prev => prev.map(v => (v.id === id ? toView(updated) : v)));
    setActiveViewId(id);
    setDirtyViewId(null);
  }, [current]);

  const loadView = useCallback((view: AccountView) => {
    onApply(view.filters ?? EMPTY);
    setActiveViewId(view.id);
    setDirtyViewId(null);
  }, [onApply]);

  /** Nothing is applied any more (Clear all), as opposed to markDirty's
   *  "a view is applied but has been edited". */
  const clearActive = useCallback(() => {
    setActiveViewId(null);
    setDirtyViewId(null);
  }, []);

  const removeView = useCallback(async (id: string): Promise<void> => {
    const ok = await deleteAudience(Number(id)).catch(() => false);
    if (!ok) return;
    setViews(prev => prev.filter(v => v.id !== id));
    setActiveViewId(prev => (prev === id ? null : prev));
    setDirtyViewId(prev => (prev === id ? null : prev));
  }, []);

  return {
    views, loading,
    activeViewId, dirtyViewId,
    markDirty, clearActive, saveView, updateViewFilters, loadView, removeView,
  };
}
