import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";

const API_BASE = "/api";

interface PendingReviewItem {
  id: number;
}

export function usePendingReviewCount(): { count: number; loading: boolean } {
  const { canReview } = useAuth();
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canReview) {
      setCount(0);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`${API_BASE}/lp/pages/pending-review`, { credentials: "include" })
      .then((r) => (r.ok ? (r.json() as Promise<PendingReviewItem[]>) : []))
      .then((rows) => {
        if (cancelled) return;
        setCount(Array.isArray(rows) ? rows.length : 0);
      })
      .catch(() => {
        if (cancelled) return;
        setCount(0);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canReview]);

  return { count, loading };
}
