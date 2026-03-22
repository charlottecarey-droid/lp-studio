import { useState, useEffect } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useListTests } from "@workspace/api-client-react";
import { StatusBadge } from "@/components/status-badge";
import { ShareReviewModal } from "@/components/collaboration/share-review-modal";
import { useReviews } from "@/hooks/use-collaboration";
import type { PageReview } from "@/hooks/use-collaboration";
import {
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Share2,
  ExternalLink,
  Inbox,
  BarChart3,
} from "lucide-react";

const API_BASE = "/api";

interface TestReviewSummary {
  testId: number;
  testName: string;
  testSlug: string;
  testStatus: string;
  testType: string;
  updatedAt: string;
  reviews: PageReview[];
  latestStatus: "pending" | "approved" | "changes_requested" | null;
}

function ReviewStatusBadge({ status }: { status: string }) {
  if (status === "approved") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
        <CheckCircle2 className="w-3 h-3" /> Approved
      </span>
    );
  }
  if (status === "changes_requested") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
        <XCircle className="w-3 h-3" /> Changes Requested
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
      <Clock className="w-3 h-3" /> Pending
    </span>
  );
}

function ShareModalWrapper({
  testId,
  testName,
  onClose,
}: {
  testId: number;
  testName: string;
  onClose: () => void;
}) {
  const { reviews, createReview } = useReviews(testId);

  return (
    <ShareReviewModal
      open
      onClose={onClose}
      pageId={testId}
      pageName={testName}
      reviews={reviews}
      onCreateReview={createReview}
    />
  );
}

export default function ReviewsOverview() {
  const { data: tests, isLoading: testsLoading } = useListTests();
  const [rows, setRows] = useState<TestReviewSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [shareModal, setShareModal] = useState<{ testId: number; testName: string } | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "changes_requested">("all");

  useEffect(() => {
    if (!tests || testsLoading) return;

    async function fetchAll() {
      setLoading(true);
      const results: TestReviewSummary[] = [];

      for (const test of tests!) {
        try {
          const res = await fetch(`${API_BASE}/lp/pages/${test.id}/reviews`);
          const reviews: PageReview[] = res.ok ? await res.json() : [];
          const decided = reviews.find(r => r.status !== "pending");
          const pending = reviews.find(r => r.status === "pending");
          const latestStatus = (decided?.status ?? pending?.status ?? null) as TestReviewSummary["latestStatus"];
          results.push({
            testId: test.id,
            testName: test.name,
            testSlug: test.slug,
            testStatus: test.status,
            testType: test.testType,
            updatedAt: test.updatedAt,
            reviews,
            latestStatus,
          });
        } catch {
          results.push({
            testId: test.id,
            testName: test.name,
            testSlug: test.slug,
            testStatus: test.status,
            testType: test.testType,
            updatedAt: test.updatedAt,
            reviews: [],
            latestStatus: null,
          });
        }
      }

      const order = { pending: 0, changes_requested: 1, approved: 2 } as Record<string, number>;
      results.sort((a, b) => {
        const aO = a.latestStatus ? (order[a.latestStatus] ?? 3) : 3;
        const bO = b.latestStatus ? (order[b.latestStatus] ?? 3) : 3;
        if (aO !== bO) return aO - bO;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });

      setRows(results);
      setLoading(false);
    }

    fetchAll();
  }, [tests, testsLoading]);

  const filtered = rows.filter(t => {
    if (filter === "all") return true;
    return t.latestStatus === filter;
  });

  const pendingCount = rows.filter(t => t.latestStatus === "pending").length;
  const approvedCount = rows.filter(t => t.latestStatus === "approved").length;
  const changesCount = rows.filter(t => t.latestStatus === "changes_requested").length;
  const noReviewCount = rows.filter(t => t.reviews.length === 0).length;

  const base = window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, "");

  return (
    <AppLayout>
      <div className="flex flex-col gap-8 pb-12">
        {/* Header */}
        <div className="pt-2">
          <h1 className="text-3xl font-display font-bold text-foreground">Reviews</h1>
          <p className="text-muted-foreground mt-1 text-base">
            Share experiments for review and track feedback across all your landing pages.
          </p>
        </div>

        {/* Stat tiles */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Pending", value: loading ? null : pendingCount, icon: <Clock className="w-3.5 h-3.5" />, color: "text-blue-600", f: "pending" as const },
            { label: "Approved", value: loading ? null : approvedCount, icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: "text-emerald-600", f: "approved" as const },
            { label: "Needs Changes", value: loading ? null : changesCount, icon: <XCircle className="w-3.5 h-3.5" />, color: "text-amber-600", f: "changes_requested" as const },
            { label: "No Reviews Yet", value: loading ? null : noReviewCount, icon: <Inbox className="w-3.5 h-3.5" />, color: "text-muted-foreground", f: "all" as const },
          ].map((stat) => (
            <Card
              key={stat.label}
              className={`p-5 rounded-2xl border cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 ${filter === stat.f ? "border-primary/40 bg-primary/5" : "border-border/60 bg-card"}`}
              onClick={() => setFilter(stat.f)}
            >
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                {stat.icon}
                {stat.label}
              </div>
              {stat.value === null ? (
                <Skeleton className="h-8 w-12 rounded-lg" />
              ) : (
                <p className={`text-3xl font-display font-bold ${stat.color}`}>{stat.value}</p>
              )}
            </Card>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          {(["all", "pending", "changes_requested", "approved"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filter === f ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}
            >
              {f === "all" ? "All Experiments" : f === "changes_requested" ? "Needs Changes" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* List */}
        {loading || testsLoading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center">
              <ClipboardCheck className="w-6 h-6 text-muted-foreground/50" />
            </div>
            <div>
              <p className="font-semibold text-foreground mb-1">No reviews here</p>
              <p className="text-sm text-muted-foreground">Click the Share button on any row to send it for review.</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {filtered.map(item => (
              <div
                key={item.testId}
                className="group flex items-center gap-4 px-5 py-4 bg-card border border-border/60 rounded-2xl hover:border-primary/25 hover:shadow-md transition-all duration-150"
              >
                <div className={`flex-shrink-0 w-2.5 h-2.5 rounded-full ${item.testStatus === "running" ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/30"}`} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-semibold text-foreground text-sm">{item.testName}</span>
                    <StatusBadge status={item.testStatus} />
                    {item.latestStatus ? (
                      <ReviewStatusBadge status={item.latestStatus} />
                    ) : (
                      <span className="text-xs text-muted-foreground/50 italic">No reviews sent</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <code className="text-xs text-muted-foreground font-mono">/lp/{item.testSlug}</code>
                    {item.reviews.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {item.reviews.length} link{item.reviews.length !== 1 ? "s" : ""} sent
                      </span>
                    )}
                    {item.reviews.filter(r => r.reviewerName).slice(0, 2).map(r => (
                      <span key={r.id} className="text-xs text-muted-foreground/60 italic">
                        {r.reviewerName}
                        {r.decisionComment ? ` — "${r.decisionComment}"` : ""}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="hidden md:flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                  {format(new Date(item.updatedAt), "MMM d")}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {item.testStatus === "running" && (
                    <a href={`${base}/lp/${item.testSlug}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary" title="Open live page">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                    </a>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary"
                    title="Share for review"
                    onClick={() => setShareModal({ testId: item.testId, testName: item.testName })}
                  >
                    <Share2 className="w-3.5 h-3.5" />
                  </Button>
                  <Link href={`/tests/${item.testId}`}>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-muted" title="Open experiment">
                      <BarChart3 className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tip */}
        <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/15 rounded-xl">
          <Share2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <p className="text-sm text-muted-foreground leading-relaxed">
            <strong className="text-foreground font-semibold">How reviews work:</strong> Click the Share icon on any experiment to generate a review link. Reviewers open the link, see the live page, and can approve it or request changes — no account needed.
          </p>
        </div>
      </div>

      {shareModal && (
        <ShareModalWrapper
          testId={shareModal.testId}
          testName={shareModal.testName}
          onClose={() => setShareModal(null)}
        />
      )}
    </AppLayout>
  );
}
