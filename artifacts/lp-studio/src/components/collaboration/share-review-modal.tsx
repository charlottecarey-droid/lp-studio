import { useState } from "react";
import { Link2, Copy, CheckCheck, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
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
}

export function ShareReviewModal({ open, onClose, pageId, pageName, reviews, onCreateReview }: ShareReviewModalProps) {
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);
  const [latestReviewUrl, setLatestReviewUrl] = useState<string | null>(null);

  const latestReview = reviews[reviews.length - 1];
  const baseUrl = window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, "");

  const reviewUrl = latestReviewUrl
    ?? (latestReview ? `${baseUrl}/review/${pageId}?token=${latestReview.token}` : null);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const result = await onCreateReview();
      if (result) {
        setLatestReviewUrl(`${baseUrl}/review/${pageId}?token=${result.token}`);
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

          {reviews.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Review History</p>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {[...reviews].reverse().map(review => (
                  <div key={review.id} className="flex items-center justify-between gap-2 py-1.5 px-3 rounded-lg bg-muted/30 border border-border/40">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`px-1.5 py-0.5 rounded-full border text-[10px] font-medium shrink-0 ${statusColor(review.status)}`}>
                        {statusLabel(review.status)}
                      </span>
                      <span className="text-xs text-muted-foreground truncate">
                        {review.reviewerName || "Awaiting reviewer"}
                      </span>
                    </div>
                    {review.decisionComment && (
                      <span className="text-xs text-muted-foreground truncate max-w-[120px]" title={review.decisionComment}>
                        "{review.decisionComment}"
                      </span>
                    )}
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
