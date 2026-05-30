import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";

const API_BASE = "/api";
const POLL_INTERVAL_MS = 60_000;

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

  useEffect(() => {
    if (!isAuthed) {
      setItems([]);
      setUnreadCount(0);
      loadedRef.current = false;
      return;
    }
    void refreshCount();
    const id = window.setInterval(() => void refreshCount(), POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [isAuthed, refreshCount]);

  return { items, unreadCount, loading, loadItems, markRead, markAllRead };
}
