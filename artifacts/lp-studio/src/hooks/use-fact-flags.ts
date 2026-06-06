// Task #1138 — React hook backing the Strict Facts review flow. Loads the
// persistent per-page fact flags, exposes the pending count that drives the
// builder banner + publish gate, and wraps every per-row action so callers
// just re-render off `flags`/`pendingCount`.
import { useCallback, useEffect, useState } from "react";
import {
  type FactFlag,
  approveFactFlag,
  bulkApproveFactFlags,
  editFactFlag,
  listFactFlags,
  removeFactFlag,
  saveFactToLibrary,
  swapFactFlag,
  undoFactFlag,
} from "@/lib/fact-flags-api";

export interface UseFactFlags {
  flags: FactFlag[];
  pendingCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  approve: (id: number) => Promise<void>;
  edit: (id: number, text: string) => Promise<void>;
  swap: (id: number, proofPointId: number) => Promise<void>;
  remove: (id: number) => Promise<void>;
  saveToLibrary: (id: number, opts?: { value?: string; label?: string }) => Promise<void>;
  undo: (id: number) => Promise<void>;
  bulkApprove: () => Promise<number>;
}

export function useFactFlags(pageId: number | string | undefined): UseFactFlags {
  const [flags, setFlags] = useState<FactFlag[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (pageId === undefined || pageId === null || pageId === "") return;
    setLoading(true);
    try {
      const res = await listFactFlags(pageId);
      setFlags(res.flags);
      setPendingCount(res.pendingCount);
    } finally {
      setLoading(false);
    }
  }, [pageId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Each action mutates one flag server-side, then refetches so derived state
  // (pendingCount, the banner, the publish gate) stays a single source of truth.
  const run = useCallback(
    async (fn: () => Promise<unknown>) => {
      await fn();
      await refresh();
    },
    [refresh],
  );

  const approve = useCallback((id: number) => run(() => approveFactFlag(id)), [run]);
  const edit = useCallback((id: number, text: string) => run(() => editFactFlag(id, text)), [run]);
  const swap = useCallback((id: number, ppId: number) => run(() => swapFactFlag(id, ppId)), [run]);
  const remove = useCallback((id: number) => run(() => removeFactFlag(id)), [run]);
  const saveToLibrary = useCallback(
    (id: number, opts?: { value?: string; label?: string }) => run(() => saveFactToLibrary(id, opts)),
    [run],
  );
  const undo = useCallback((id: number) => run(() => undoFactFlag(id)), [run]);
  const bulkApprove = useCallback(async () => {
    if (pageId === undefined) return 0;
    const res = await bulkApproveFactFlags(pageId);
    await refresh();
    return res.approved;
  }, [pageId, refresh]);

  return {
    flags,
    pendingCount,
    loading,
    refresh,
    approve,
    edit,
    swap,
    remove,
    saveToLibrary,
    undo,
    bulkApprove,
  };
}
