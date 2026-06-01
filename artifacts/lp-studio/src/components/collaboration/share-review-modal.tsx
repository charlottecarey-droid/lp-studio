import { useState } from "react";
import { Link2, Copy, CheckCheck, ExternalLink, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PageReview } from "@/hooks/use-collaboration";

function statusColor(status: string) {
  if (status === "approved") return "bg-green-100 text-green-700 border-green-200";
  if (status === "changes_requested") return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

function statusLabel(status: string) {
  if (status === "approved") return "Approved";
  if (status === "changes_requested") return "Changes Requested";
  return "Pending";
}

interface ShareReviewModalProps {
  open: boolean;
  onClose: () => void;
  pageId: number;
  pageName: string;
  reviews: PageReview[];
  onCreateReview: () => Promise<{ token: string; reviewUrl: string } | null>;
  onDeleteReview: (reviewId: number) => Promise<boolean>;
  onDeleteReviews: (reviewIds: number[]) => Promise<boolean>;
}

export function ShareReviewModal({ open, onClose, pageId, pageName, reviews, onCreateReview, onDeleteReview, onDeleteReviews }: ShareReviewModalProps) {
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deletingBatch, setDeletingBatch] = useState(false);
  const [latestReviewUrl, setLatestReviewUrl] = useState<string | null>(null);

  const latestReview = [...reviews].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )[0];
  const baseUrl = window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, "");

  const reviewUrl = latestReviewUrl
    ?? (latestReview ? `${baseUrl}/review/${latestReview.token}` : null);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const result = await onCreateReview();
      if (result) {
        setLatestReviewUrl(`${baseUrl}/review/${result.token}`);
      }
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = () => {
    if (!reviewUrl) return;
    navigator.clipboard.writeText(reviewUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = async (reviewId: number) => {
    setDeletingId(reviewId);
    try {
      await onDeleteReview(reviewId);
      if (latestReview?.id === reviewId) {
        setLatestReviewUrl(null);
      }
      setSelectedIds(prev => {
        if (!prev.has(reviewId)) return prev;
        const next = new Set(prev);
        next.delete(reviewId);
        return next;
      });
    } finally {
      setDeletingId(null);
    }
  };

  const sortedReviews = [...reviews].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  const allSelected = sortedReviews.length > 0 && sortedReviews.every(r => selectedIds.has(r.id));

  const toggleOne = (reviewId: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(reviewId)) next.delete(reviewId);
      else next.add(reviewId);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(sortedReviews.map(r => r.id)));
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    setDeletingBatch(true);
    try {
      const ok = await onDeleteReviews(ids);
      if (ok) {
        if (latestReview && ids.includes(latestReview.id)) {
          setLatestReviewUrl(null);
        }
        setSelectedIds(new Set());
      }
    } finally {
      setDeletingBatch(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-primary" />
            Share for Review
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          <div>
            <p className="text-sm text-muted-foreground mb-3">
              Generate a link that lets anyone review and approve <span className="font-medium text-foreground">{pageName}</span> without logging in.
            </p>

            {reviewUrl ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={reviewUrl}
                    readOnly
                    className="text-xs font-mono bg-muted/50 border-border/60"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={handleCopy}
                  >
                    {copied ? <CheckCheck className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => window.open(reviewUrl, "_blank")}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>

                {latestReview && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Current status:</span>
                    <span className={`px-2 py-0.5 rounded-full border text-xs font-medium ${statusColor(latestReview.status)}`}>
                      {statusLabel(latestReview.status)}
                    </span>
                    {latestReview.reviewerName && (
                      <span>by <span className="font-medium text-foreground">{latestReview.reviewerName}</span></span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <Button
                className="w-full"
                onClick={handleCreate}
                disabled={creating}
              >
                <Link2 className="w-4 h-4 mr-2" />
                {creating ? "Generating..." : "Generate Review Link"}
              </Button>
            )}
          </div>

          {reviewUrl && (
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={handleCreate}
              disabled={creating}
            >
              {creating ? "Creating..." : "Create New Review Link"}
            </Button>
          )}

          {sortedReviews.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Review History</p>
                {selectedIds.size > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleBulkDelete}
                    disabled={deletingBatch}
                    className="h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    {deletingBatch ? "Deleting..." : `Delete ${selectedIds.size}`}
                  </Button>
                )}
              </div>
              {sortedReviews.length > 1 && (
                <label className="flex items-center gap-2 mb-1.5 px-3 cursor-pointer select-none w-fit">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all review links" />
                  <span className="text-[11px] text-muted-foreground">{allSelected ? "Deselect all" : "Select all"}</span>
                </label>
              )}
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {sortedReviews.map(review => (
                  <div key={review.id} className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-muted/30 border border-border/40">
                    <Checkbox
                      checked={selectedIds.has(review.id)}
                      onCheckedChange={() => toggleOne(review.id)}
                      aria-label="Select review link"
                      className="shrink-0"
                    />
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className={`px-1.5 py-0.5 rounded-full border text-[10px] font-medium shrink-0 ${statusColor(review.status)}`}>
                        {statusLabel(review.status)}
                      </span>
                      <span className="text-xs text-muted-foreground truncate">
                        {review.reviewerName || "Awaiting reviewer"}
                      </span>
                      {review.decisionComment && (
                        <span className="text-xs text-muted-foreground truncate max-w-[100px]" title={review.decisionComment}>
                          "{review.decisionComment}"
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(review.id)}
                      disabled={deletingId === review.id}
                      className="shrink-0 p-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground/40 transition-colors disabled:opacity-40"
                      title="Delete this review link"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
