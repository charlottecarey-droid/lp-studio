import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

const API_BASE = "/api";
// When the live SSE channel is healthy we only need polling as a slow backstop
// (covers cross-replica misses, where a push happened on another instance).
// When SSE is unavailable we fall back to the original tighter poll.
const POLL_INTERVAL_MS = 60_000;
const POLL_INTERVAL_SSE_MS = 5 * 60_000;
// Collapse a burst of live pushes that land within this window into a single
// running "N new notifications" toast instead of spawning one per item.
const TOAST_BURST_MS = 4_000;

export interface NotificationItem {
  id: number;
  templateKey: string;
  title: string | null;
  body: string | null;
  ctaUrl: string | null;
  ctaLabel: string | null;
  read: boolean;
  createdAt: string;
}

/**
 * In-app notification inbox for the signed-in user. Polls the unread count on a
 * light interval and lazily loads the full list. POSTs ride the global
 * CSRF-aware fetch interceptor, so plain fetch is fine here.
 */
export function useNotifications() {
  const { user } = useAuth();
  const isAuthed = !!user;
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const loadedRef = useRef(false);
  // Toast throttling state for live pushes.
  const toastedIdsRef = useRef<Set<number>>(new Set());
  const lastToastAtRef = useRef(0);
  const burstCountRef = useRef(0);

  const refreshCount = useCallback(async () => {
    if (!isAuthed) return;
    try {
      const r = await fetch(`${API_BASE}/notifications/unread-count`, { credentials: "include" });
      if (!r.ok) return;
      const data = (await r.json()) as { count: number };
      setUnreadCount(Number(data.count) || 0);
    } catch {
      /* transient — keep last known count */
    }
  }, [isAuthed]);

  const loadItems = useCallback(async () => {
    if (!isAuthed) return;
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/notifications`, { credentials: "include" });
      if (r.ok) {
        const data = (await r.json()) as { items: NotificationItem[] };
        const list = Array.isArray(data.items) ? data.items : [];
        setItems(list);
        setUnreadCount(list.filter((i) => !i.read).length);
        loadedRef.current = true;
      }
    } catch {
      /* transient */
    } finally {
      setLoading(false);
    }
  }, [isAuthed]);

  const markRead = useCallback(async (ids: number[]) => {
    if (!ids.length) return;
    setItems((prev) => prev.map((i) => (ids.includes(i.id) ? { ...i, read: true } : i)));
    setUnreadCount((c) => Math.max(0, c - ids.length));
    try {
      await fetch(`${API_BASE}/notifications/mark-read`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
    } catch {
      /* optimistic; count re-syncs on next poll */
    }
  }, []);

  const markAllRead = useCallback(async () => {
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    setUnreadCount(0);
    try {
      await fetch(`${API_BASE}/notifications/mark-all-read`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      /* optimistic */
    }
  }, []);

  // Surface a brief toast for a notification that just arrived over the live
  // channel. Dedupe by id (a push can race a poll) and collapse a rapid burst
  // into a single running "N new notifications" toast so we never spam.
  const notifyLive = useCallback(
    (item: NotificationItem) => {
      // Already-read items (e.g. cross-tab echoes) shouldn't nudge.
      if (item.read) return;
      if (toastedIdsRef.current.has(item.id)) return;
      toastedIdsRef.current.add(item.id);

      const now = Date.now();
      const inBurst = now - lastToastAtRef.current < TOAST_BURST_MS;
      lastToastAtRef.current = now;

      if (inBurst) {
        // Collapse the burst into a single running count. The toast list is
        // capped at 1, so a fresh toast() replaces the prior one in place —
        // simpler and more reliable than mutating a possibly-stale handle.
        burstCountRef.current += 1;
        toast({
          title: `${burstCountRef.current} new notifications`,
          description: "Open the bell to review them.",
        });
        return;
      }

      // Start of a fresh (non-burst) window: show this single notification.
      burstCountRef.current = 1;
      const action = item.ctaUrl ? (
        <ToastAction
          altText={item.ctaLabel ?? "View"}
          onClick={() => {
            void markRead([item.id]);
            window.location.href = item.ctaUrl as string;
          }}
        >
          {item.ctaLabel ?? "View"}
        </ToastAction>
      ) : undefined;

      toast({
        title: item.title ?? "New notification",
        description: item.body ?? undefined,
        action,
      });
    },
    [markRead],
  );

  // Merge a notification pushed over the live SSE channel. Dedupe by id so a
  // push that races the next poll/inbox load doesn't double-count the badge.
  const ingestLive = useCallback((item: NotificationItem) => {
    setItems((prev) => {
      if (prev.some((i) => i.id === item.id)) return prev;
      // Only prepend to the in-memory list once the inbox has been opened;
      // otherwise loadItems() will fetch the canonical list on first open.
      return loadedRef.current ? [item, ...prev] : prev;
    });
    setUnreadCount((c) => {
      // When the inbox is loaded we keep the badge in sync with the (deduped)
      // list; otherwise just bump the count for the new unread item.
      return item.read ? c : c + 1;
    });
  }, []);

  useEffect(() => {
    if (!isAuthed) {
      setItems([]);
      setUnreadCount(0);
      loadedRef.current = false;
      // Forget which items we've already toasted so a re-login starts clean.
      toastedIdsRef.current.clear();
      lastToastAtRef.current = 0;
      burstCountRef.current = 0;
      return;
    }

    void refreshCount();

    let pollId: number | undefined;
    const startPolling = (intervalMs: number) => {
      if (pollId !== undefined) window.clearInterval(pollId);
      pollId = window.setInterval(() => void refreshCount(), intervalMs);
    };
    // Tight polling until/unless SSE proves healthy.
    startPolling(POLL_INTERVAL_MS);

    // Live channel. EventSource auto-reconnects on transient drops; on hard
    // failure we simply keep the tighter polling cadence as the backstop.
    let es: EventSource | null = null;
    if (typeof window !== "undefined" && "EventSource" in window) {
      try {
        es = new EventSource(`${API_BASE}/notifications/stream`, { withCredentials: true });
        es.addEventListener("open", () => {
          // SSE is delivering — relax polling to a slow backstop.
          startPolling(POLL_INTERVAL_SSE_MS);
        });
        es.addEventListener("notification", (ev) => {
          try {
            const item = JSON.parse((ev as MessageEvent).data) as NotificationItem;
            if (item && typeof item.id === "number") {
              ingestLive(item);
              notifyLive(item);
            }
          } catch {
            // Malformed push — fall back to a count refresh.
            void refreshCount();
          }
        });
        es.addEventListener("error", () => {
          // Drop back to tight polling while the channel is down. EventSource
          // keeps trying to reconnect; `open` will relax the cadence again.
          startPolling(POLL_INTERVAL_MS);
        });
      } catch {
        /* EventSource construction failed — polling-only mode */
      }
    }

    return () => {
      if (pollId !== undefined) window.clearInterval(pollId);
      es?.close();
    };
  }, [isAuthed, refreshCount, ingestLive, notifyLive]);

  return { items, unreadCount, loading, loadItems, markRead, markAllRead };
}
