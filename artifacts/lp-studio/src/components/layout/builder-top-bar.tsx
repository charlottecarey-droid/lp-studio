import { useState, useEffect, type RefObject } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft, Save, Globe, CheckCircle, FlaskConical,
  MessageSquare, Share2, Eye, ExternalLink, Check, Star, Send, ThumbsUp, ThumbsDown,
  Clock, Megaphone, Users, ChevronDown, X, MoreHorizontal, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { PresenceStrip } from "@/components/collaboration/presence-strip";
import type { PresenceViewer } from "@/hooks/use-collaboration";

interface BuilderTopBarProps {
  title: string;
  titleRef: RefObject<HTMLInputElement>;
  status: "draft" | "pending_review" | "published";
  isSaving: boolean;
  saveSuccess: boolean;
  /** Task #266 — when false, the Save button dims and the indicator next to
   *  it switches from "Unsaved changes" to "Saved". */
  isDirty?: boolean;
  /** Task #266 — Date.now() of the last successful save, surfaced as a
   *  human-friendly "Saved 12s ago" hint when the page is clean. */
  lastSavedAt?: number | null;
  commentMode: boolean;
  viewers: PresenceViewer[];
  unresolvedComments?: number;
  segmentName?: string | null;
  segmentId?: string | null;
  availableSegments?: { id: string; name: string }[];
  onSegmentChange?: (segmentId: string | null) => void;
  liveUrl: string;
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
  canPublish?: boolean;
  canReview?: boolean;
  onSubmitForReview?: () => void;
  onApproveReview?: () => void;
  onRejectReview?: () => void;
  reviewWorkflowEnabled?: boolean;
  /** Task #1026 — catalog mode: editing a global block default, not a page.
   *  Hides page-only chrome (segment, comments, more menu, preview, review,
   *  publish) so the bar reads Back / title / Save only. */
  catalogMode?: boolean;
  /** Save-button label override used in catalog mode (e.g. "Save default"). */
  catalogSaveLabel?: string;
}

/** "Saved 12s ago" / "Saved 5m ago" / "Saved" copy. */
function formatSavedAgo(ts: number, now: number): string {
  const sec = Math.max(0, Math.floor((now - ts) / 1000));
  if (sec < 5) return "Saved just now";
  if (sec < 60) return `Saved ${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `Saved ${min}m ago`;
  const hr = Math.floor(min / 60);
  return `Saved ${hr}h ago`;
}

export function BuilderTopBar({
  title,
  titleRef,
  status,
  isSaving,
  saveSuccess,
  isDirty = true,
  lastSavedAt,
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
  catalogMode = false,
  catalogSaveLabel,
}: BuilderTopBarProps) {
  const [, navigate] = useLocation();
  const [copied, setCopied] = useState(false);
  // Re-render the "Saved Ns ago" hint every 30s so it stays fresh while the
  // editor sits idle. Cheap interval — it only ticks when the bar is mounted.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  function goBack() {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      navigate("/pages");
    }
  }

  function handleViewLive() {
    navigator.clipboard.writeText(liveUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  function handlePreviewDraft() {
    navigator.clipboard.writeText(previewUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  // Save button copy + state. We dim when there's nothing to save and
  // surface the saved-just-now state directly on the button.
  const saveLabel = isSaving
    ? "Saving…"
    : saveSuccess
      ? "Saved!"
      : isDirty
        ? (catalogMode && catalogSaveLabel ? catalogSaveLabel : "Save")
        : "Saved";
  const saveIcon = isSaving
    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
    : (saveSuccess || !isDirty)
      ? <CheckCircle className="w-3.5 h-3.5" />
      : <Save className="w-3.5 h-3.5" />;

  // Subtle text hint to the LEFT of the Save button. Reflects autosave-like
  // "Saved 12s ago" when clean, or "Unsaved changes" when dirty. Hidden on
  // narrow screens to keep the bar uncluttered.
  const savedHint = isDirty
    ? "Unsaved changes"
    : lastSavedAt
      ? formatSavedAgo(lastSavedAt, now)
      : "All changes saved";

  return (
    <header className="h-14 flex items-center gap-2 px-4 border-b border-border bg-background/80 backdrop-blur-xl shrink-0">
      {/* ── Left zone: back + page identity ───────────────────────────── */}
      <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground -ml-2" onClick={goBack}>
        <ArrowLeft className="w-4 h-4" />
        <span className="hidden sm:inline text-xs">Back</span>
      </Button>

      <div className="h-5 w-px bg-border" />

      <input
        ref={titleRef}
        value={title}
        onChange={e => onTitleChange(e.target.value)}
        onBlur={onTitleBlur}
        className="min-w-0 flex-shrink max-w-xs bg-transparent text-sm font-semibold text-foreground outline-none border-b border-transparent hover:border-border focus:border-primary transition-colors py-0.5"
        placeholder="Page Title"
      />

      {!catalogMode && (() => {
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
            <span className={triggerClass} title={`Tailored for segment: ${segmentName}`} data-testid="page-segment-badge">
              <Users className="w-3 h-3" />
              Segment: {segmentName}
            </span>
          );
        }

        return (
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className={triggerClass} title={segmentName ? `Tailored for segment: ${segmentName} — click to change` : "Assign this page to a segment"} data-testid="page-segment-badge">
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

      {!catalogMode && (
      <Badge
        variant={status === "published" ? "default" : "secondary"}
        className={cn(
          "text-[10px] shrink-0 gap-1 h-5 px-2",
          status === "published" && "bg-green-500/10 text-green-700 border-green-200",
          status === "pending_review" && "bg-amber-500/10 text-amber-700 border-amber-200",
        )}
        data-testid="page-status-badge"
      >
        {status === "pending_review" && <Clock className="w-3 h-3" />}
        {status === "published" ? "Live" : status === "pending_review" ? "Pending Review" : "Draft"}
      </Badge>
      )}

      {/* Spacer pushes everything else to the right */}
      <div className="flex-1" />

      {/* ── "Saved Ns ago" hint sits just left of the action cluster ─── */}
      <span
        className={cn(
          "hidden lg:inline text-[11px] tabular-nums shrink-0 mr-1",
          isDirty ? "text-amber-600" : "text-muted-foreground",
        )}
        data-testid="save-state-hint"
      >
        {savedHint}
      </span>

      <PresenceStrip viewers={viewers} />

      {!catalogMode && (
      <>
      <div className="hidden md:block h-5 w-px bg-border mx-0.5" />

      {/* ── Utility cluster: Comments + More overflow ──────────────────
           Save-as-Template, A/B Test, and Ad Copy used to be three
           always-visible square icons next to the page identity. They
           were equal-weight with the primary save/publish row and
           crowded the bar. Folded into a single "More" overflow menu
           so the right cluster reads as Comments / Share / Preview /
           Save / Publish — primary actions only. */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={commentMode ? "default" : "outline"}
            size="sm"
            className={cn(
              "h-8 px-2 gap-1.5 text-xs relative",
              commentMode && "bg-amber-500 hover:bg-amber-600 text-white",
            )}
            onClick={onToggleCommentMode}
            data-testid="builder-comments-button"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Comments</span>
            {unresolvedComments > 0 && !commentMode && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                {unresolvedComments > 9 ? "9+" : unresolvedComments}
              </span>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {commentMode ? "Stop commenting" : "Comments"}
        </TooltipContent>
      </Tooltip>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            aria-label="More actions"
            title="More actions"
            data-testid="builder-more-button"
          >
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Page actions
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={onSaveAsTemplate} className="gap-2 text-xs">
            <Star className="w-3.5 h-3.5 text-amber-500" />
            Save as Template
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onOpenAbTest} className="gap-2 text-xs" data-testid="open-ab-test-button">
            <FlaskConical className="w-3.5 h-3.5 text-primary" />
            Create A/B Test
          </DropdownMenuItem>
          {onOpenAdCopy && (
            <DropdownMenuItem onClick={onOpenAdCopy} className="gap-2 text-xs" data-testid="open-ad-copy-button">
              <Megaphone className="w-3.5 h-3.5 text-fuchsia-600" />
              Generate Ad Copy
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onShareForReview} className="gap-2 text-xs">
            <Share2 className="w-3.5 h-3.5" />
            Share for Review
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      </>
      )}

      {!catalogMode && (
      <>
      <div className="hidden md:block h-5 w-px bg-border mx-0.5" />

      {/* Preview / View button — adapts based on publish status */}
      {status === "published" ? (
        <a href={liveUrl} target="_blank" rel="noopener noreferrer" onClick={handleViewLive}>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-8 gap-1.5 text-xs transition-colors",
              copied && "border-green-500 text-green-600",
            )}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <ExternalLink className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copied ? "Copied!" : "View"}</span>
          </Button>
        </a>
      ) : (
        <a href={previewUrl} target="_blank" rel="noopener noreferrer" onClick={handlePreviewDraft} title={`Open and copy preview link: ${previewUrl}`}>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-8 gap-1.5 text-xs transition-colors",
              copied && "border-green-500 text-green-600",
            )}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copied ? "Link copied!" : "Preview"}</span>
          </Button>
        </a>
      )}
      </>
      )}

      <Button
        variant={isDirty ? "default" : "outline"}
        size="sm"
        className={cn(
          "h-8 gap-1.5 text-xs",
          saveSuccess && "border-green-500 text-green-600 bg-transparent hover:bg-green-50",
          !isDirty && !saveSuccess && "text-muted-foreground",
        )}
        onClick={onSave}
        disabled={isSaving || (!isDirty && !saveSuccess)}
        data-testid="save-button"
      >
        {saveIcon}
        <span className="hidden sm:inline">{saveLabel}</span>
      </Button>

      {!catalogMode && reviewWorkflowEnabled && status === "pending_review" && canReview && (
        <>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs text-red-600 border-red-200 hover:bg-red-50"
            onClick={onRejectReview}
            disabled={isSaving}
            data-testid="reject-review-button"
          >
            <ThumbsDown className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reject</span>
          </Button>
          <Button
            size="sm"
            className="h-8 gap-1.5 text-xs bg-green-600 hover:bg-green-700"
            onClick={onApproveReview}
            disabled={isSaving}
            data-testid="approve-review-button"
          >
            <ThumbsUp className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Approve & Publish</span>
          </Button>
        </>
      )}

      {!catalogMode && reviewWorkflowEnabled && status !== "published" && (
        <Button
          size="sm"
          variant={status === "pending_review" ? "outline" : "default"}
          className="h-8 gap-1.5 text-xs"
          onClick={onSubmitForReview}
          disabled={isSaving || status === "pending_review"}
          data-testid="submit-review-button"
        >
          {status === "pending_review" ? <Clock className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">{status === "pending_review" ? "In Review" : "Submit for Review"}</span>
        </Button>
      )}

      {!catalogMode && canPublish && (
        <Button
          size="sm"
          className="h-8 gap-1.5 text-xs"
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
