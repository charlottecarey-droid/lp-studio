import { useCallback, useEffect, useMemo, useState } from "react";
import {
  governanceMapFromRows,
  type GovernanceMap,
  type TenantBlockGovernanceEntry,
} from "@/lib/block-governance-client";

const ENDPOINT = "/api/tenant/block-governance";

interface GovernancePayload {
  entries: TenantBlockGovernanceEntry[];
}

/**
 * Tenant block governance hook (task #4). Mirrors `useTenantBlockLibraryPrefs`:
 * GET on mount, PUT a full-replace map. Returns the raw entries (for the
 * governance editor) plus a resolved `GovernanceMap` (blockType → entry) for
 * the builder's availability / segment-approval resolution. Fail-open: a
 * missing/failed read just means "no governance" (empty map = today).
 */
export function useTenantBlockGovernance() {
  const [entries, setEntries] = useState<TenantBlockGovernanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(ENDPOINT, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: GovernancePayload) => {
        if (cancelled) return;
        setEntries(Array.isArray(data?.entries) ? data.entries : []);
        setError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        setEntries([]);
        setError(String(e?.message ?? e));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(async (next: TenantBlockGovernanceEntry[]): Promise<boolean> => {
    setSaving(true);
    try {
      const res = await fetch(ENDPOINT, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: next }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const saved = (await res.json()) as GovernancePayload;
      setEntries(Array.isArray(saved?.entries) ? saved.entries : []);
      setError(null);
      return true;
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const governanceMap: GovernanceMap = useMemo(() => governanceMapFromRows(entries), [entries]);

  return { entries, governanceMap, save, loading, saving, error };
}
