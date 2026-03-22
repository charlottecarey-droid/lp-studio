import { useState } from "react";
import { Link2, CheckCircle2, AlertCircle, Clock, MessageSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useReviews } from "@/hooks/use-collaboration";
import { ShareReviewModal } from "@/components/collaboration/share-review-modal";

interface ReviewsTabProps {
  testId: number;
  testName: string;
}

function statusIcon(status: string) {
  if (status === "approved") return <CheckCircle2 className="w-4 h-4 text-green-600" />;
  if (status === "changes_requested") return <AlertCircle className="w-4 h-4 text-amber-600" />;
  return <Clock className="w-4 h-4 text-slate-400" />;
}

function statusLabel(status: string) {
  if (status === "approved") return "Approved";
  if (status === "changes_requested") return "Changes Requested";
  return "Pending";
}

function statusClasses(status: string) {
  if (status === "approved") return "bg-green-50 text-green-700 border-green-200";
  if (status === "changes_requested") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-slate-50 text-slate-600 border-slate-200";
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ReviewsTab({ testId, testName }: ReviewsTabProps) {
  const { reviews, createReview } = useReviews(testId);
  const [shareOpen, setShareOpen] = useState(false);

  const latestReview = reviews[reviews.length - 1];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">Review Links</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Share review links so stakeholders can approve or request changes.
          </p>
        </div>
        <Button onClick={() => setShareOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Share for Review
        </Button>
      </div>

      {/* Current status summary */}
      {latestReview && (
        <Card className="p-4 border-border/50">
          <div className="flex items-center gap-3">
            {statusIcon(latestReview.status)}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">Latest Review</span>
                <span className={`px-2 py-0.5 rounded-full border text-xs font-medium ${statusClasses(latestReview.status)}`}>
                  {statusLabel(latestReview.status)}
                </span>
              </div>
              {latestReview.reviewerName && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  by <span className="font-medium text-foreground">{latestReview.reviewerName}</span> · {formatDate(latestReview.updatedAt)}
                </p>
              )}
              {latestReview.decisionComment && (
                <div className="flex items-start gap-1.5 mt-2">
                  <MessageSquare className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="text-xs text-foreground/80">"{latestReview.decisionComment}"</p>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* All reviews list */}
      {reviews.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-border/50 rounded-2xl">
          <Link2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="font-medium text-muted-foreground">No review links yet</p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Generate a link to let stakeholders review this page.
          </p>
          <Button variant="outline" className="mt-4 gap-2" onClick={() => setShareOpen(true)}>
            <Plus className="w-4 h-4" />
            Create First Review Link
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">All Reviews</p>
          {[...reviews].reverse().map(review => (
            <div key={review.id} className="flex items-start gap-3 p-4 rounded-xl border border-border/50 bg-card hover:bg-muted/20 transition-colors">
              <div className="shrink-0 mt-0.5">{statusIcon(review.status)}</div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2 py-0.5 rounded-full border text-xs font-medium ${statusClasses(review.status)}`}>
                    {statusLabel(review.status)}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatDate(review.createdAt)}</span>
                </div>
                {review.reviewerName ? (
                  <p className="text-sm font-medium">{review.reviewerName}</p>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Awaiting reviewer</p>
                )}
                {review.decisionComment && (
                  <p className="text-xs text-foreground/70 truncate">"{review.decisionComment}"</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ShareReviewModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        pageId={testId}
        pageName={testName}
        reviews={reviews}
        onCreateReview={createReview}
      />
    </div>
  );
}
