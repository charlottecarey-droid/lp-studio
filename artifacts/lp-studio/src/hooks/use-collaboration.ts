import { useState, useEffect, useCallback, useRef } from "react";

const API_BASE = "/api";

export interface PageComment {
  id: number;
  pageId: number;
  blockIndex: number;
  authorName: string;
  message: string;
  parentId: number | null;
  resolved: boolean;
  createdAt: string;
}

export interface CommentThread {
  comment: PageComment;
  replies: PageComment[];
}

export interface BlockComments {
  blockIndex: number;
  threads: CommentThread[];
}

export interface PageReview {
  id: number;
  pageId: number;
  token: string;
  reviewerName: string | null;
  status: string;
  decisionComment: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PresenceViewer {
  pageId: number;
  viewerId: string;
  displayName: string;
  lastSeen: string;
}

function getOrCreateViewerId(): string {
  let id = localStorage.getItem("lp_viewer_id");
  if (!id) {
    id = "viewer-" + Math.random().toString(36).slice(2, 10);
    localStorage.setItem("lp_viewer_id", id);
  }
  return id;
}

export function getAuthorName(): string {
  return localStorage.getItem("lp_author_name") || "";
}

export function setAuthorName(name: string): void {
  localStorage.setItem("lp_author_name", name);
}

export function useComments(pageId: number) {
  const [blocks, setBlocks] = useState<BlockComments[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchComments = useCallback(async () => {
    if (!pageId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/lp/pages/${pageId}/comments`);
      if (res.ok) {
        const data = await res.json();
        setBlocks(data);
      }
    } finally {
      setLoading(false);
    }
  }, [pageId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const addComment = useCallback(async (params: {
    blockIndex: number;
    authorName: string;
    message: string;
    parentId?: number;
  }) => {
    const res = await fetch(`${API_BASE}/lp/pages/${pageId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (res.ok) {
      await fetchComments();
    }
  }, [pageId, fetchComments]);

  const resolveComment = useCallback(async (commentId: number) => {
    const res = await fetch(`${API_BASE}/lp/pages/${pageId}/comments/${commentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolved: true }),
    });
    if (res.ok) {
      await fetchComments();
    }
  }, [pageId, fetchComments]);

  return { blocks, loading, fetchComments, addComment, resolveComment };
}

export function useReviews(pageId: number) {
  const [reviews, setReviews] = useState<PageReview[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchReviews = useCallback(async () => {
    if (!pageId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/lp/pages/${pageId}/reviews`);
      if (res.ok) {
        const data = await res.json();
        setReviews(data);
      }
    } finally {
      setLoading(false);
    }
  }, [pageId]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const createReview = useCallback(async (): Promise<{ token: string; reviewUrl: string } | null> => {
    const res = await fetch(`${API_BASE}/lp/pages/${pageId}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.ok) {
      const data = await res.json();
      await fetchReviews();
      return data;
    }
    return null;
  }, [pageId, fetchReviews]);

  const deleteReview = useCallback(async (reviewId: number): Promise<boolean> => {
    const res = await fetch(`${API_BASE}/lp/pages/${pageId}/reviews/${reviewId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      await fetchReviews();
      return true;
    }
    return false;
  }, [pageId, fetchReviews]);

  return { reviews, loading, fetchReviews, createReview, deleteReview };
}

export function usePresence(pageId: number, displayName: string) {
  const [viewers, setViewers] = useState<PresenceViewer[]>([]);
  const viewerId = getOrCreateViewerId();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPingRef = useRef<number>(0);

  const pingPresence = useCallback(async () => {
    if (!pageId || !displayName) return;

    // Debounce: only ping if at least 30 seconds have passed since last ping
    const now = Date.now();
    if (now - lastPingRef.current < 30000) return;
    lastPingRef.current = now;

    try {
      const res = await fetch(`${API_BASE}/lp/pages/${pageId}/presence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ viewerId, displayName }),
      });
      if (res.ok) {
        const data = await res.json();
        setViewers(data);
      }
    } catch (err) {
      console.error("Presence ping error:", err);
    }
  }, [pageId, displayName, viewerId]);

  useEffect(() => {
    if (!pageId || !displayName) return;
    // Initial ping on mount
    lastPingRef.current = Date.now() - 30000; // Allow immediate ping
    pingPresence();
    // Check every 5 seconds, but debounce ensures we only actually ping every 30 seconds
    intervalRef.current = setInterval(pingPresence, 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [pageId, displayName, pingPresence]);

  const seen = new Set<string>();
  const otherViewers = viewers.filter(v => {
    if (v.viewerId === viewerId) return false;
    if (seen.has(v.viewerId)) return false;
    seen.add(v.viewerId);
    return true;
  });
  return { viewers: otherViewers, viewerId };
}
