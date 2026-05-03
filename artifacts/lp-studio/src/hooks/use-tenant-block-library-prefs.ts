import { useCallback, useEffect, useState } from "react";
import { EMPTY_PREFS, type BlockLibraryPrefs } from "@/lib/block-library-prefs";

const ENDPOINT = "/api/tenant/block-library-prefs";

export function useTenantBlockLibraryPrefs() {
  const [prefs, setPrefs] = useState<BlockLibraryPrefs>(EMPTY_PREFS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(ENDPOINT, { credentials: "include" })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: BlockLibraryPrefs) => {
        if (cancelled) return;
        setPrefs({ ...EMPTY_PREFS, ...data });
        setError(null);
      })
      .catch(e => {
        if (cancelled) return;
        // Non-fatal: a missing/failed prefs read just means "no overrides".
        setPrefs(EMPTY_PREFS);
        setError(String(e?.message ?? e));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(async (next: BlockLibraryPrefs): Promise<boolean> => {
    setSaving(true);
    try {
      const res = await fetch(ENDPOINT, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const saved = (await res.json()) as BlockLibraryPrefs;
      setPrefs({ ...EMPTY_PREFS, ...saved });
      setError(null);
      return true;
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  return { prefs, setPrefs, save, loading, saving, error };
}
