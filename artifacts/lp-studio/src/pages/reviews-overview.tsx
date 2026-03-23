import { useState, useEffect } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ShareReviewModal } from "@/components/collaboration/share-review-modal";
import { useReviews } from "@/hooks/use-collaboration";
import type { PageReview } from "@/hooks/use-collaboration";
import {
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Share2,
  Edit2,
  Inbox,
  Globe,
} from "lucide-react";

const API_BASE = "/api";

interface BuilderPage {
  id: number;
  title: string;
  slug: string;
  status: "draft" | "published";
  blocks: unknown[];
  updatedAt: string;
}

interface PageReviewSummary {
  pageId: number;
  pageTitle: string;
  pageSlug: string;
  pageStatus: string;
  blockCount: number;
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
  pageId,
  pageTitle,
  onClose,
}: {
  pageId: number;
  pageTitle: string;
  onClose: () => void;
}) {
  const { reviews, createReview } = useReviews(pageId);

  return (
    <ShareReviewModal
      open
      onClose={onClose}
      pageId={pageId}
      pageName={pageTitle}
      reviews={reviews}
      onCreateReview={createReview}
    />
  );
}

export default function ReviewsOverview() {
  const [rows, setRows] = useState<PageReviewSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [shareModal, setShareModal] = useState<{ pageId: number; pageTitle: string } | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "changes_requested">("all");

  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      try {
        const pagesRes = await fetch(`${API_BASE}/lp/pages`);
        const pages: BuilderPage[] = pagesRes.ok ? await pagesRes.json() : [];

        const results: PageReviewSummary[] = [];

        for (const page of pages) {
          try {
            const res = await fetch(`${API_BASE}/lp/pages/${page.id}/reviews`);
            const reviews: PageReview[] = res.ok ? await res.json() : [];
            const decided = reviews.find(r => r.status !== "pending");
            const pending = reviews.find(r => r.status === "pending");
            const latestStatus = (decided?.status ?? pending?.status ?? null) as PageReviewSummary["latestStatus"];
            results.push({
              pageId: page.id,
              pageTitle: page.title,
              pageSlug: page.slug,
              pageStatus: page.status,
              blockCount: (page.blocks ?? []).length,
              updatedAt: page.updatedAt,
              reviews,
              latestStatus,
            });
          } catch {
            results.push({
              pageId: page.id,
              pageTitle: page.title,
              pageSlug: page.slug,
              pageStatus: page.status,
              blockCount: (page.blocks ?? []).length,
              updatedAt: page.updatedAt,
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
      } finally {
        setLoading(false);
      }
    }

    fetchAll();
  }, []);

  const filtered = rows.filter(r => {
    if (filter === "all") return true;
    return r.latestStatus === filter;
  });

  const pendingCount = rows.filter(r => r.latestStatus === "pending").length;
  const approvedCount = rows.filter(r => r.latestStatus === "approved").length;
  const changesCount = rows.filter(r => r.latestStatus === "changes_requested").length;
  const noReviewCount = rows.filter(r => r.reviews.length === 0).length;

  return (
    <AppLayout>
      <div className="flex flex-col gap-8 pb-12">
        {/* Header */}
        <div className="pt-2">
          <h1 className="text-3xl font-display font-bold text-foreground">Reviews</h1>
          <p className="text-muted-foreground mt-1 text-base">
            Share custom pages for approval and track feedback in one place.
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
              {f === "all" ? "All Pages" : f === "changes_requested" ? "Needs Changes" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
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
              <p className="text-sm text-muted-foreground">Click the Share button on any page to send it for review.</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {filtered.map(item => (
              <div
                key={item.pageId}
                className="group flex items-center gap-4 px-5 py-4 bg-card border border-border/60 rounded-2xl hover:border-primary/25 hover:shadow-md transition-all duration-150"
              >
                <div className={`flex-shrink-0 w-2.5 h-2.5 rounded-full ${item.pageStatus === "published" ? "bg-emerald-500" : "bg-muted-foreground/30"}`} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-semibold text-foreground text-sm">{item.pageTitle}</span>
                    {item.pageStatus === "published" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                        <Globe className="w-3 h-3" /> Published
                      </span>
                    )}
                    {item.latestStatus ? (
                      <ReviewStatusBadge status={item.latestStatus} />
                    ) : (
                      <span className="text-xs text-muted-foreground/50 italic">No reviews sent</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <code className="text-xs text-muted-foreground font-mono">/lp/{item.pageSlug}</code>
                    <span className="text-xs text-muted-foreground">{item.blockCount} block{item.blockCount !== 1 ? "s" : ""}</span>
                    {item.reviews.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {item.reviews.length} review link{item.reviews.length !== 1 ? "s" : ""} sent
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
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary"
                    title="Share for review"
                    onClick={() => setShareModal({ pageId: item.pageId, pageTitle: item.pageTitle })}
                  >
                    <Share2 className="w-3.5 h-3.5" />
                  </Button>
                  <Link href={`/builder/${item.pageId}`}>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-muted" title="Edit page">
                      <Edit2 className="w-3.5 h-3.5" />
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
          pageId={shareModal.pageId}
          pageTitle={shareModal.pageTitle}
          onClose={() => setShareModal(null)}
        />
      )}
    </AppLayout>
  );
}
