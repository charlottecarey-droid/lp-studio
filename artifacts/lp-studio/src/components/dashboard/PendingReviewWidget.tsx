import { useEffect, useState, useCallback } from "react";
import { Link } from "wouter";
import { formatDistanceToNowStrict } from "date-fns";
import { Clock, ThumbsUp, ThumbsDown, ExternalLink, Eye } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import { getLpPreviewUrl } from "@/lib/utils";

const API_BASE = "/api";

interface PendingReviewItem {
  id: number;
  title: string;
  slug: string;
  submittedAt: string | null;
  submittedBy: string | null;
  asanaTaskId: string | null;
}

export function PendingReviewWidget() {
  const { canReview, domainContext } = useAuth();
  const [items, setItems] = useState<PendingReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`${API_BASE}/lp/pages/pending-review`, { credentials: "include" })
      .then((r) => (r.ok ? (r.json() as Promise<PendingReviewItem[]>) : []))
      .then((rows) => setItems(Array.isArray(rows) ? rows : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (canReview) load();
  }, [canReview, load]);

  if (!canReview) return null;
  if (!loading && items.length === 0) return null;

  const micrositeDomain = domainContext?.micrositeDomain ?? null;

  async function approve(id: number) {
    if (!confirm("Approve and publish this page?")) return;
    setActingId(id);
    try {
      const res = await fetch(`${API_BASE}/lp/pages/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({} as { error?: string }));
        throw new Error(j.error ?? `Approve failed (HTTP ${res.status})`);
      }
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to approve");
    } finally {
      setActingId(null);
    }
  }

  async function reject(id: number) {
    const note = window.prompt("Reason for rejection (required):", "");
    if (!note || !note.trim()) return;
    setActingId(id);
    try {
      const res = await fetch(`${API_BASE}/lp/pages/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ note: note.trim() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({} as { error?: string }));
        throw new Error(j.error ?? `Reject failed (HTTP ${res.status})`);
      }
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to reject");
    } finally {
      setActingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4" data-testid="pending-review-widget">
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <Clock className="w-3 h-3" />
          Pending Review
          {!loading && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-amber-500/10 text-amber-700 border-amber-200 dark:text-amber-300 dark:border-amber-800/40">
              {items.length}
            </Badge>
          )}
        </h2>
      </div>

      <Card className="border-0 rounded-2xl ring-1 ring-foreground/[0.06] shadow-[0_1px_2px_rgba(2,6,23,0.04),0_10px_28px_-18px_rgba(2,6,23,0.12)] overflow-hidden divide-y divide-border">
        {loading ? (
          <div className="p-4 flex flex-col gap-3">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        ) : (
          items.map((item) => {
            const requester = item.submittedBy ?? "Unknown";
            const age = item.submittedAt
              ? formatDistanceToNowStrict(new Date(item.submittedAt), { addSuffix: true })
              : "just now";
            const previewUrl = getLpPreviewUrl(item.slug, micrositeDomain);
            const isActing = actingId === item.id;
            return (
              <div
                key={item.id}
                className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 hover:bg-muted/30 transition-colors"
                data-testid={`pending-review-row-${item.id}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link href={`/builder/${item.id}`}>
                      <p className="font-medium text-sm text-foreground hover:underline cursor-pointer truncate">
                        {item.title}
                      </p>
                    </Link>
                    {item.asanaTaskId && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                        Asana
                      </Badge>
                    )}
                    <a
                      href={previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                      data-testid={`pending-review-preview-${item.id}`}
                    >
                      <Eye className="w-3 h-3" />
                      Preview <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    Submitted by {requester} · {age}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 sm:flex-initial gap-1.5 text-xs text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-900 dark:hover:bg-red-950/30"
                    disabled={isActing}
                    onClick={() => reject(item.id)}
                    data-testid={`pending-review-reject-${item.id}`}
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 sm:flex-initial gap-1.5 text-xs bg-green-600 hover:bg-green-700"
                    disabled={isActing}
                    onClick={() => approve(item.id)}
                    data-testid={`pending-review-approve-${item.id}`}
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                    Approve
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}
