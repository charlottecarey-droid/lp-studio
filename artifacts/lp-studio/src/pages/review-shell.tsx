import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { ChevronDown, ChevronUp, CheckCircle2, AlertCircle, Clock, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const API_BASE = "/api";

interface ReviewData {
  review: {
    id: number;
    pageId: number;
    token: string;
    reviewerName: string | null;
    status: string;
    decisionComment: string | null;
    createdAt: string;
    updatedAt: string;
  };
  page: {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    status: string;
  };
}

function statusIcon(status: string) {
  if (status === "approved") return <CheckCircle2 className="w-4 h-4 text-green-600" />;
  if (status === "changes_requested") return <AlertCircle className="w-4 h-4 text-amber-600" />;
  return <Clock className="w-4 h-4 text-slate-400" />;
}

function statusLabel(status: string) {
  if (status === "approved") return "Approved";
  if (status === "changes_requested") return "Changes Requested";
  return "Pending Review";
}

function statusClasses(status: string) {
  if (status === "approved") return "bg-green-100 text-green-800 border-green-200";
  if (status === "changes_requested") return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function getStoredReviewerName(token: string): string {
  return localStorage.getItem(`lp_reviewer_${token}`) || "";
}
function storeReviewerName(token: string, name: string) {
  localStorage.setItem(`lp_reviewer_${token}`, name);
}

export default function ReviewShell() {
  const [match, params] = useRoute("/review/:pageId");
  const pageId = params?.pageId;
  const token = new URLSearchParams(window.location.search).get("token") ?? "";

  const [data, setData] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const [reviewerName, setReviewerName] = useState(() => getStoredReviewerName(token));
  const [requestChangesComment, setRequestChangesComment] = useState("");
  const [showChangesInput, setShowChangesInput] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!token) { setError("No review token provided."); setLoading(false); return; }
    fetch(`${API_BASE}/lp/review/${token}`)
      .then(r => r.ok ? r.json() : Promise.reject("Not found"))
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setError("Review link not found or expired."); setLoading(false); });
  }, [token]);

  const handleDecision = async (status: "approved" | "changes_requested") => {
    if (!reviewerName.trim()) return;
    if (status === "changes_requested" && !requestChangesComment.trim()) return;

    storeReviewerName(token, reviewerName.trim());

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/lp/review/${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewerName: reviewerName.trim(),
          status,
          decisionComment: status === "changes_requested" ? requestChangesComment.trim() : undefined,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setData(prev => prev ? { ...prev, review: updated } : prev);
        setSubmitted(true);
        setShowChangesInput(false);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading review...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
          <p className="font-medium">{error || "Review not found"}</p>
          <p className="text-sm text-muted-foreground">Check that the review link is correct.</p>
        </div>
      </div>
    );
  }

  const { review, page } = data;
  const isDecided = review.status !== "pending";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Review banner */}
      <div className={`sticky top-0 z-50 w-full bg-white border-b border-border/60 shadow-sm transition-all duration-200 ${collapsed ? "py-1" : "py-3"}`}>
        <div className="max-w-5xl mx-auto px-4">
          {collapsed ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {statusIcon(review.status)}
                <span className="text-sm font-medium">{page.name}</span>
                <span className={`px-2 py-0.5 rounded-full border text-xs font-medium ${statusClasses(review.status)}`}>
                  {statusLabel(review.status)}
                </span>
              </div>
              <button
                onClick={() => setCollapsed(false)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronDown className="w-4 h-4" />
                Show review bar
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Review Request</p>
                    <p className="font-semibold text-foreground">{page.name}</p>
                  </div>
                  <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${statusClasses(review.status)}`}>
                    {statusIcon(review.status)}
                    {statusLabel(review.status)}
                  </span>
                </div>
                <button
                  onClick={() => setCollapsed(true)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronUp className="w-4 h-4" />
                  Collapse
                </button>
              </div>

              {isDecided ? (
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground">
                    Decision by <span className="font-medium text-foreground">{review.reviewerName}</span>
                  </span>
                  {review.decisionComment && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span className="italic">"{review.decisionComment}"</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3 flex-wrap">
                  <Input
                    placeholder="Your name"
                    value={reviewerName}
                    onChange={e => setReviewerName(e.target.value)}
                    className="w-44 h-8 text-sm"
                  />
                  
                  {showChangesInput ? (
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Textarea
                        placeholder="Describe what needs to change..."
                        value={requestChangesComment}
                        onChange={e => setRequestChangesComment(e.target.value)}
                        className="min-h-[36px] h-9 text-sm resize-none flex-1"
                        autoFocus
                      />
                      <Button
                        size="sm"
                        variant="destructive"
                        className="shrink-0 h-8"
                        onClick={() => handleDecision("changes_requested")}
                        disabled={submitting || !reviewerName.trim() || !requestChangesComment.trim()}
                      >
                        {submitting ? "Submitting..." : "Submit"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="shrink-0 h-8"
                        onClick={() => setShowChangesInput(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        className="h-8 bg-green-600 hover:bg-green-700 text-white gap-1.5"
                        onClick={() => handleDecision("approved")}
                        disabled={submitting || !reviewerName.trim()}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 border-amber-300 text-amber-700 hover:bg-amber-50 gap-1.5"
                        onClick={() => setShowChangesInput(true)}
                        disabled={submitting || !reviewerName.trim()}
                      >
                        <AlertCircle className="w-3.5 h-3.5" />
                        Request Changes
                      </Button>
                    </div>
                  )}

                  {submitted && (
                    <span className="text-sm text-green-600 font-medium">Decision submitted!</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Page preview area */}
      <div className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        <div className="bg-card border border-border/50 rounded-2xl p-8 shadow-sm">
          <div className="space-y-3 mb-8 pb-6 border-b border-border/40">
            <h1 className="text-2xl font-bold font-display">{page.name}</h1>
            {page.description && (
              <p className="text-muted-foreground">{page.description}</p>
            )}
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="bg-muted px-2 py-0.5 rounded font-mono text-xs">/lp/{page.slug}</span>
              <span className="capitalize">{page.status} test</span>
            </div>
          </div>

          <div className="text-center py-12 space-y-3">
            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto">
              <MessageSquare className="w-8 h-8 text-muted-foreground/40" />
            </div>
            <p className="text-muted-foreground font-medium">Landing Page Preview</p>
            <p className="text-sm text-muted-foreground/70 max-w-sm mx-auto">
              The full landing page preview would render here. Use the review bar above to submit your feedback.
            </p>
            <a
              href={`/lp/${page.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline mt-2"
            >
              Open live page in new tab →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
