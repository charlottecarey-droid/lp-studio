import { useState, type RefObject } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft, Save, Globe, CheckCircle, FlaskConical,
  MessageSquare, Share2, Eye, ExternalLink, Check, Star, Send, ThumbsUp, ThumbsDown,
  Clock, Megaphone, Users, ChevronDown, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { PresenceStrip } from "@/components/collaboration/presence-strip";
import type { PresenceViewer } from "@/hooks/use-collaboration";

interface BuilderTopBarProps {
  title: string;
  titleRef: RefObject<HTMLInputElement>;
  status: "draft" | "pending_review" | "published";
  isSaving: boolean;
  saveSuccess: boolean;
  commentMode: boolean;
  viewers: PresenceViewer[];
  unresolvedComments?: number;
  /** Audience segment this page was tailored to at creation time, if any.
   * Surfaces a "Segment: <name>" badge next to the title so editors can tell
   * at a glance which audience the copy was generated for. */
  segmentName?: string | null;
  /** Currently-assigned segment id, if any. Used to highlight the selected
   * row in the segment popover by id (segment names are not guaranteed to
   * be unique). */
  segmentId?: string | null;
  /** Available audience segments from brand settings. When provided alongside
   * `onSegmentChange`, the segment badge becomes a popover that lets the
   * editor reassign or clear the page's segment without leaving the builder
   * (task #250). */
  availableSegments?: { id: string; name: string }[];
  /** Editor changed the page's segment from the badge popover. Pass `null`
   * to clear. Persisting (PUT /lp/pages/:pageId) is the caller's job. */
  onSegmentChange?: (segmentId: string | null) => void;
  /** Live public URL (e.g. partners.meetdandy.com/slug or /lp/slug) */
  liveUrl: string;
  /** In-app preview URL — the page viewer, visible even for drafts */
  previewUrl: string;
  onTitleChange: (title: string) => void;
  onTitleBlur: () => void;
  onSave: () => void;
  onSaveAsTemplate: () => void;
  onOpenAbTest: () => void;
  onOpenAdCopy?: () => void;
  onPublish: () => void;
  onToggleCommentMode: () => void;
  onShareForReview: () => void;
  // Page-review workflow (task #108).
  /** Whether the current user can publish (admin / pages.publish / superadmin). */
  canPublish?: boolean;
  /** Whether the current user can approve / reject pending reviews. */
  canReview?: boolean;
  /** Editor click — submit page for review. */
  onSubmitForReview?: () => void;
  /** Reviewer click — approve a pending_review page. */
  onApproveReview?: () => void;
  /** Reviewer click — reject a pending_review page (caller prompts for note). */
  onRejectReview?: () => void;
  /**
   * Task #113 — when false, hide all review-workflow buttons (Submit /
   * Approve / Reject). Defaults to true so callers that don't pass it keep
   * the existing behaviour. The "Pending Review" status badge is not
   * explicitly gated by this flag because `pending_review` is unreachable
   * in OFF mode (the submit-review endpoint returns 409), so existing pages
   * always render as Draft or Live.
   */
  reviewWorkflowEnabled?: boolean;
}

export function BuilderTopBar({
  title,
  titleRef,
  status,
  isSaving,
  saveSuccess,
  commentMode,
  viewers,
  unresolvedComments = 0,
  segmentName,
  segmentId,
  availableSegments,
  onSegmentChange,
  liveUrl,
  previewUrl,
  onTitleChange,
  onTitleBlur,
  onSave,
  onSaveAsTemplate,
  onOpenAbTest,
  onOpenAdCopy,
  onPublish,
  onToggleCommentMode,
  onShareForReview,
  canPublish = true,
  canReview = false,
  onSubmitForReview,
  onApproveReview,
  onRejectReview,
  reviewWorkflowEnabled = true,
}: BuilderTopBarProps) {
  const [, navigate] = useLocation();
  const [copied, setCopied] = useState(false);

  function goBack() {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      navigate("/pages");
    }
  }

  function handleViewLive(e: React.MouseEvent) {
    // Copy URL to clipboard when clicking "View" on published pages
    navigator.clipboard.writeText(liveUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
    // The anchor tag handles the navigation
  }

  function handlePreviewDraft(e: React.MouseEvent) {
    // Copy preview URL to clipboard when clicking "Preview" on drafts so
    // editors can share it with internal reviewers without re-typing it.
    // The preview URL is auth/token-gated server-side — see task-107.
    navigator.clipboard.writeText(previewUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  return (
    <header className="h-14 flex items-center gap-3 px-4 border-b border-border bg-background/80 backdrop-blur-xl shrink-0">
      <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground" onClick={goBack}>
        <ArrowLeft className="w-4 h-4" />
        <span className="hidden sm:inline text-xs">Back</span>
      </Button>

      <div className="h-4 w-px bg-border mx-1" />

      <input
        ref={titleRef}
        value={title}
        onChange={e => onTitleChange(e.target.value)}
        onBlur={onTitleBlur}
        className="flex-1 max-w-xs bg-transparent text-sm font-semibold text-foreground outline-none border-b border-transparent hover:border-border focus:border-primary transition-colors py-0.5"
        placeholder="Page Title"
      />

      {(() => {
        // Editors can reassign the page's segment when the parent passes both
        // a list of segments AND a change handler. Without those props the
        // badge falls back to a static label (legacy behaviour).
        const editable = !!onSegmentChange && Array.isArray(availableSegments);
        if (!editable && !segmentName) return null;

        const triggerClass = cn(
          "hidden md:inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 transition-colors",
          segmentName
            ? "text-violet-700 bg-violet-50 border border-violet-200 hover:bg-violet-100"
            : "text-muted-foreground bg-muted/40 border border-dashed border-border hover:bg-muted",
        );

        if (!editable) {
          return (
            <span
              className={triggerClass}
              title={`Tailored for segment: ${segmentName}`}
              data-testid="page-segment-badge"
            >
              <Users className="w-3 h-3" />
              Segment: {segmentName}
            </span>
          );
        }

        return (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={triggerClass}
                title={segmentName ? `Tailored for segment: ${segmentName} — click to change` : "Assign this page to a segment"}
                data-testid="page-segment-badge"
              >
                <Users className="w-3 h-3" />
                {segmentName ? `Segment: ${segmentName}` : "No segment"}
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="p-1 w-56" data-testid="page-segment-popover">
              <div className="px-2 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Assign segment
              </div>
              <div className="max-h-64 overflow-y-auto">
                {(availableSegments ?? []).length === 0 ? (
                  <p className="px-2 py-2 text-xs text-muted-foreground italic">
                    No segments defined. Add segments in Brand Settings.
                  </p>
                ) : (
                  (availableSegments ?? []).map(seg => {
                    const selected = segmentId === seg.id;
                    return (
                      <button
                        key={seg.id}
                        type="button"
                        onClick={() => onSegmentChange?.(seg.id)}
                        className={cn(
                          "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs hover:bg-muted",
                          selected && "bg-violet-50 text-violet-800",
                        )}
                        data-testid={`page-segment-option-${seg.id}`}
                      >
                        <Users className={cn("w-3 h-3", selected ? "text-violet-600" : "text-muted-foreground")} />
                        <span className="flex-1 truncate">{seg.name}</span>
                        {selected && <Check className="w-3 h-3 text-violet-600" />}
                      </button>
                    );
                  })
                )}
              </div>
              <div className="border-t border-border mt-1 pt-1">
                <button
                  type="button"
                  onClick={() => onSegmentChange?.(null)}
                  disabled={!segmentName}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs",
                    segmentName ? "hover:bg-muted text-foreground" : "text-muted-foreground/60 cursor-not-allowed",
                  )}
                  data-testid="page-segment-clear"
                >
                  <X className="w-3 h-3" />
                  Clear segment
                </button>
              </div>
            </PopoverContent>
          </Popover>
        );
      })()}

      <Badge
        variant={status === "published" ? "default" : "secondary"}
        className={cn(
          "text-xs shrink-0 gap-1",
          status === "published" && "bg-green-500/10 text-green-700 border-green-200",
          status === "pending_review" && "bg-amber-500/10 text-amber-700 border-amber-200",
        )}
        data-testid="page-status-badge"
      >
        {status === "pending_review" && <Clock className="w-3 h-3" />}
        {status === "published" ? "Live" : status === "pending_review" ? "Pending Review" : "Draft"}
      </Badge>

      {/*
        Template, A/B Test, and Ad Copy are icon-only square buttons grouped
        next to the Live/Draft chip so editors can jump to template/test/ad
        flows from the page identity area instead of the action cluster on
        the right. Native `title` is kept as a fallback for screen readers /
        no-JS; the Radix Tooltip provides the rich on-hover label matching
        the rest of the app. Width is locked square (h-8 w-8 + p-0).
      */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            aria-label="Save as Template"
            title="Save as Template"
            className="h-8 w-8 p-0 text-amber-600 border-amber-200 hover:bg-amber-50"
            onClick={onSaveAsTemplate}
          >
            <Star className="w-3.5 h-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">Save as Template</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            aria-label="A/B Test"
            title="A/B Test"
            className="h-8 w-8 p-0 text-primary border-primary/30 hover:bg-primary/5"
            onClick={onOpenAbTest}
          >
            <FlaskConical className="w-3.5 h-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">A/B Test</TooltipContent>
      </Tooltip>

      {onOpenAdCopy && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              aria-label="Ad Copy"
              title="Ad Copy"
              className="h-8 w-8 p-0 text-fuchsia-700 border-fuchsia-200 hover:bg-fuchsia-50 dark:text-fuchsia-300 dark:border-fuchsia-900/50"
              onClick={onOpenAdCopy}
              data-testid="open-ad-copy-button"
            >
              <Megaphone className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Ad Copy</TooltipContent>
        </Tooltip>
      )}

      <div className="flex-1" />

      <PresenceStrip viewers={viewers} />

      <Button
        variant={commentMode ? "default" : "outline"}
        size="sm"
        className={cn("gap-1.5 text-xs relative", commentMode && "bg-amber-500 hover:bg-amber-600 text-white")}
        onClick={onToggleCommentMode}
      >
        <MessageSquare className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Comments</span>
        {unresolvedComments > 0 && !commentMode && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {unresolvedComments > 9 ? "9+" : unresolvedComments}
          </span>
        )}
      </Button>

      <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={onShareForReview}>
        <Share2 className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Share</span>
      </Button>

      {/* Preview / View button — adapts based on publish status */}
      {status === "published" ? (
        <a href={liveUrl} target="_blank" rel="noopener noreferrer" onClick={handleViewLive}>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "gap-1.5 text-xs transition-colors",
              copied && "border-green-500 text-green-600",
            )}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <ExternalLink className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copied ? "Copied!" : "View"}</span>
          </Button>
        </a>
      ) : (
        <a
          href={previewUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handlePreviewDraft}
          title={`Open and copy preview link: ${previewUrl}`}
        >
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "gap-1.5 text-xs transition-colors",
              copied && "border-green-500 text-green-600",
            )}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copied ? "Link copied!" : "Preview"}</span>
          </Button>
        </a>
      )}

      <Button
        variant="outline"
        size="sm"
        className={cn("gap-1.5 text-xs", saveSuccess && "border-green-500 text-green-600")}
        onClick={onSave}
        disabled={isSaving}
      >
        {saveSuccess ? <CheckCircle className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
        <span className="hidden sm:inline">{saveSuccess ? "Saved!" : "Save"}</span>
      </Button>

      {/*
        Page-review buttons (task #108).
        - Reviewers see Approve/Reject when status=pending_review.
        - Editors without publish perm see Submit-for-Review (or "In Review"
          disabled while a request is open).
        - Publishers see the original Publish/Unpublish button.
      */}
      {reviewWorkflowEnabled && status === "pending_review" && canReview && (
        <>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs text-red-600 border-red-200 hover:bg-red-50"
            onClick={onRejectReview}
            disabled={isSaving}
            data-testid="reject-review-button"
          >
            <ThumbsDown className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reject</span>
          </Button>
          <Button
            size="sm"
            className="gap-1.5 text-xs bg-green-600 hover:bg-green-700"
            onClick={onApproveReview}
            disabled={isSaving}
            data-testid="approve-review-button"
          >
            <ThumbsUp className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Approve & Publish</span>
          </Button>
        </>
      )}

      {/* Submit for Review is always available on non-published pages so that
          publish-capable users (admins / Content Managers / superadmins) can
          still ask a peer to review before pushing to production. Editors who
          lack publish rights also see this — for them it's the only path.
          Task #113: hidden entirely when the tenant has the workflow off. */}
      {reviewWorkflowEnabled && status !== "published" && (
        <Button
          size="sm"
          variant={status === "pending_review" ? "outline" : "default"}
          className="gap-1.5 text-xs"
          onClick={onSubmitForReview}
          disabled={isSaving || status === "pending_review"}
          data-testid="submit-review-button"
        >
          {status === "pending_review" ? <Clock className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">{status === "pending_review" ? "In Review" : "Submit for Review"}</span>
        </Button>
      )}

      {canPublish && (
        <Button
          size="sm"
          className="gap-1.5 text-xs"
          onClick={onPublish}
          disabled={isSaving}
          variant={status === "published" ? "outline" : "brand"}
          data-testid="publish-button"
        >
          <Globe className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{status === "published" ? "Unpublish" : "Publish"}</span>
        </Button>
      )}
    </header>
  );
}
