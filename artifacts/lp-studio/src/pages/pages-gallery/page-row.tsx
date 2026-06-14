import { Link } from "wouter";
import {
  Clock,
  Edit2,
  ExternalLink,
  Globe,
  Link2,
  MessageSquare,
  Star,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, getLpPageUrl } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { scorePageSeoGeo, gradeBgColor, type ScoreResult } from "@/lib/seo-scoring";
import { CopyButton } from "./copy-button";
import { PageActionsMenu } from "./page-actions-menu";
import { countLinkedGlobalBlocks, formatDate } from "./utils";
import type { ColumnVisibility, Page, PerfScore } from "./types";

interface Props {
  page: Page;
  isAdmin: boolean;
  columnVisibility: ColumnVisibility;
  gridTemplate: string;
  micrositeDomain: string | null;
  isRunning: boolean;
  perf: PerfScore | undefined;
  commentCount: number;
  segmentName?: string | null;
  selected: boolean;
  onToggleSelect: () => void;
  cloningPageId: number | null;
  onClone: () => void;
  onRewriteCopy: () => void;
  onAbTest: () => void;
  onLinks: () => void;
  onShare: () => void;
  onDelete: () => void;
  onTemplateSaved: (updated: Page) => void;
}

export function PageRow({
  page,
  isAdmin,
  columnVisibility,
  gridTemplate,
  micrositeDomain,
  isRunning,
  perf,
  commentCount,
  segmentName,
  selected,
  onToggleSelect,
  cloningPageId,
  onClone,
  onRewriteCopy,
  onAbTest,
  onLinks,
  onShare,
  onDelete,
  onTemplateSaved,
}: Props) {
  const { user } = useAuth();
  const tenantHost = user?.tenantHost ?? null;
  const isPublished = page.status === "published";
  const liveUrl = isPublished || isRunning ? getLpPageUrl(page.slug, micrositeDomain, tenantHost) : null;
  // For drafts (no live URL), fall back to the in-app preview route so the
  // "view" / external-link button always opens *something* — the live page if
  // it exists, otherwise the authenticated preview. Without this, clicking
  // view on a draft loaded the public live URL which 404s.
  const viewUrl = liveUrl ?? `/preview/${page.slug}`;
  const viewIsPreview = liveUrl === null;
  const linkedCount = countLinkedGlobalBlocks(page.blocks);
  const linkedBadge = linkedCount > 0 ? (
    <Link href={`/builder/${page.id}`}>
      <span
        className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-full hover:bg-indigo-100 transition-colors shrink-0"
        title={`${linkedCount} block${linkedCount === 1 ? "" : "s"} linked to a shared master — edits to the master change this page`}
      >
        <Link2 className="w-2.5 h-2.5" />
        Linked: {linkedCount}
      </span>
    </Link>
  ) : null;
  // Segment chip is now hidden from the pages list — it's still shown
  // (and editable) inside the builder top bar, where it's more relevant
  // to the page being worked on. Keeping the `segmentName` prop in the
  // signature so callers (results-list) don't need to change and we can
  // resurrect the badge later without reworking the data flow.
  void segmentName;
  let seoScore: ScoreResult | null = null;
  try {
    if (page.blocks?.length > 0) {
      seoScore = scorePageSeoGeo(page.blocks ?? [], { metaTitle: page.metaTitle, metaDescription: page.metaDescription, ogImage: page.ogImage, slug: page.slug });
    }
  } catch {}

  const statusBadge = (
    <span className={cn(
      "inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md shrink-0",
      isPublished ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400" :
      isRunning ? "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400" :
      "bg-muted text-muted-foreground"
    )}>
      {isPublished ? <><Globe className="w-2.5 h-2.5" /> Live</> :
       isRunning ? <><Globe className="w-2.5 h-2.5" /> Running</> :
       <><Clock className="w-2.5 h-2.5" /> Draft</>}
    </span>
  );

  return (
    <div className="hover:bg-muted/30 transition-colors first:rounded-t-lg last:rounded-b-lg">

      {/* ── Stacked card layout (hidden on lg+) — used on phones and iPad ── */}
      <div className="lg:hidden px-4 py-4 flex flex-col gap-3">
        {/* Title row + status badge */}
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            className="w-4 h-4 rounded border-muted-foreground/40 accent-primary cursor-pointer mt-1"
            checked={selected}
            onChange={onToggleSelect}
            onClick={e => e.stopPropagation()}
          />
          <div className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${isPublished || isRunning ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/20"}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link href={`/builder/${page.id}`}>
                <span className="text-[13px] font-medium text-foreground hover:underline cursor-pointer">{page.title}</span>
              </Link>
              {page.isTemplate && <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />}
              {commentCount > 0 && (
                <Link href={`/builder/${page.id}?comments=1`}>
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full hover:bg-amber-100 transition-colors" title={`${commentCount} open comment(s)`}>
                    <MessageSquare className="w-2.5 h-2.5" />
                    {commentCount}
                  </span>
                </Link>
              )}
              {linkedBadge}
              {statusBadge}
            </div>
            <code className="text-[11px] text-muted-foreground/70 font-mono mt-0.5 block truncate">
              {micrositeDomain ? `/${page.slug}` : `/lp/${page.slug}`}
            </code>
            {isAdmin && (page.updatedByName || page.updatedBy || page.createdByName || page.createdBy) && (
              <span className="text-[11px] text-muted-foreground/50 mt-0.5 block truncate">
                {page.updatedByName ?? page.updatedBy ?? page.createdByName ?? page.createdBy}
              </span>
            )}
          </div>
        </div>

        {/* Actions row — always visible on mobile */}
        <div className="flex items-center gap-2 pl-5">
          <Link href={`/builder/${page.id}`}>
            <Button variant="outline" size="sm" className="h-8 px-3 text-xs gap-1.5 rounded-lg">
              <Edit2 className="w-3 h-3" /> Edit
            </Button>
          </Link>
          <a href={viewUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="h-8 px-3 text-xs gap-1.5 rounded-lg">
              <ExternalLink className="w-3 h-3" /> Preview
            </Button>
          </a>
          {liveUrl && <CopyButton url={liveUrl} />}
          <div className="ml-auto">
            <PageActionsMenu
              page={page}
              cloningPageId={cloningPageId}
              onClone={onClone}
              onRewriteCopy={onRewriteCopy}
              onAbTest={onAbTest}
              onLinks={onLinks}
              onShare={onShare}
              onDelete={onDelete}
              onTemplateSaved={onTemplateSaved}
            />
          </div>
        </div>
      </div>

      {/* ── Desktop table layout (lg and up) ── */}
      <div
        className="hidden lg:grid gap-3 items-center px-4 py-3.5 group"
        style={{ gridTemplateColumns: gridTemplate }}
      >
        {/* Checkbox */}
        <div className="flex items-center">
          <input
            type="checkbox"
            className="w-3.5 h-3.5 rounded border-muted-foreground/40 accent-primary cursor-pointer"
            checked={selected}
            onChange={onToggleSelect}
            onClick={e => e.stopPropagation()}
          />
        </div>

        {/* Page name + slug */}
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-2 h-2 rounded-full shrink-0 ${isPublished || isRunning ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/20"}`} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <Link href={`/builder/${page.id}`} className="min-w-0 max-w-full">
                <span className="text-[13px] font-medium text-foreground hover:underline truncate cursor-pointer block">{page.title}</span>
              </Link>
              {page.isTemplate && (
                <span title={`Template: ${page.templateLabel ?? page.title}`}>
                  <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />
                </span>
              )}
              {commentCount > 0 && (
                <Link href={`/builder/${page.id}?comments=1`}>
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full hover:bg-amber-100 transition-colors shrink-0" title={`${commentCount} open comment(s)`}>
                    <MessageSquare className="w-2.5 h-2.5" />
                    {commentCount}
                  </span>
                </Link>
              )}
              {linkedBadge}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <code className="text-[11px] text-muted-foreground/70 font-mono truncate">{micrositeDomain ? `/${page.slug}` : `/lp/${page.slug}`}</code>
              {liveUrl && <CopyButton url={liveUrl} />}
            </div>
          </div>
        </div>

        {/* Status */}
        <div>{statusBadge}</div>

        {/* Blocks */}
        <span className="text-xs text-muted-foreground tabular-nums">{page.blocks?.length ?? 0}</span>

        {/* Score: letter grade (content quality) + behavioral number (traffic) */}
        <div className="flex items-center gap-1.5">
          {seoScore && (
            <Badge
              variant="outline"
              className={cn("text-[10px] px-1.5 py-0 font-semibold", gradeBgColor(seoScore.grade))}
              title={`Content quality grade ${seoScore.grade} — SEO/GEO score ${seoScore.overallScore}/100`}
            >
              {seoScore.grade}
            </Badge>
          )}
          {perf && perf.visits > 0 && (
            <>
              <span className="text-muted-foreground/30 text-[10px] leading-none">·</span>
              <span
                className={cn(
                  "text-[11px] font-medium tabular-nums",
                  perf.composite >= 70 ? "text-emerald-600" :
                  perf.composite >= 40 ? "text-amber-600" :
                  "text-red-500"
                )}
                title={`Performance ${perf.composite}/100 — last 30 days of traffic`}
              >
                {perf.composite}
              </span>
            </>
          )}
        </div>

        {/* Updated */}
        <span className="text-xs text-muted-foreground tabular-nums">{formatDate(page.updatedAt)}</span>

        {/* Last edited (admin, optional) — who, plus updated date as tooltip */}
        {isAdmin && columnVisibility.lastEdited && (
          <div className="flex flex-col min-w-0">
            {(page.updatedByName || page.updatedBy) ? (
              <span
                className="text-xs text-muted-foreground truncate"
                title={`${page.updatedBy ?? page.updatedByName ?? ""} • ${formatDate(page.updatedAt)}`}
              >
                {page.updatedByName ?? page.updatedBy}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground/30">—</span>
            )}
          </div>
        )}

        {/* Created by (admin, optional) */}
        {isAdmin && columnVisibility.createdBy && (
          <div className="flex flex-col min-w-0">
            {(page.createdByName || page.createdBy) ? (
              <span
                className="text-xs text-muted-foreground truncate"
                title={`${page.createdBy ?? page.createdByName ?? ""} • ${formatDate(page.createdAt)}`}
              >
                {page.createdByName ?? page.createdBy}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground/30">—</span>
            )}
          </div>
        )}

        {/* Author (admin, optional) — combined fallback column kept for parity
            with the previous behaviour: prefers last editor, falls back to creator. */}
        {isAdmin && columnVisibility.author && (
          <div className="flex flex-col min-w-0">
            {(page.updatedByName || page.updatedBy) ? (
              <span className="text-xs text-muted-foreground truncate" title={page.updatedBy ?? ""}>
                {page.updatedByName ?? page.updatedBy}
              </span>
            ) : (page.createdByName || page.createdBy) ? (
              <span className="text-xs text-muted-foreground/50 truncate" title={page.createdBy ?? ""}>
                {page.createdByName ?? page.createdBy}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground/30">—</span>
            )}
          </div>
        )}

        {/* Actions — always visible on desktop too */}
        <div className="flex items-center gap-1 justify-end">
          <Link href={`/builder/${page.id}`}>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground">
              <Edit2 className="w-3 h-3" /> Edit
            </Button>
          </Link>
          <a href={viewUrl} target="_blank" rel="noopener noreferrer" title={viewIsPreview ? "Preview draft" : "Open live page"}>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
              <ExternalLink className="w-3 h-3" />
            </Button>
          </a>
          <PageActionsMenu
            page={page}
            cloningPageId={cloningPageId}
            onClone={onClone}
            onRewriteCopy={onRewriteCopy}
            onAbTest={onAbTest}
            onLinks={onLinks}
            onShare={onShare}
            onDelete={onDelete}
            onTemplateSaved={onTemplateSaved}
          />
        </div>
      </div>

    </div>
  );
}
