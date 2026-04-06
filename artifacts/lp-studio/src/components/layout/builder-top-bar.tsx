import { useState, type RefObject } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft, Save, Globe, Monitor, Smartphone, CheckCircle, FlaskConical,
  MessageSquare, Share2, Eye, ExternalLink, Check, Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PresenceStrip } from "@/components/collaboration/presence-strip";
import type { PresenceViewer } from "@/hooks/use-collaboration";

interface BuilderTopBarProps {
  title: string;
  titleRef: RefObject<HTMLInputElement>;
  status: "draft" | "published";
  isMobile: boolean;
  isSaving: boolean;
  saveSuccess: boolean;
  commentMode: boolean;
  viewers: PresenceViewer[];
  /** Live public URL (e.g. partners.meetdandy.com/slug or /lp/slug) */
  liveUrl: string;
  /** In-app preview URL — the page viewer, visible even for drafts */
  previewUrl: string;
  onTitleChange: (title: string) => void;
  onTitleBlur: () => void;
  onSetMobile: (mobile: boolean) => void;
  onSave: () => void;
  onSaveAsTemplate: () => void;
  onOpenAbTest: () => void;
  onPublish: () => void;
  onToggleCommentMode: () => void;
  onShareForReview: () => void;
}

export function BuilderTopBar({
  title,
  titleRef,
  status,
  isMobile,
  isSaving,
  saveSuccess,
  commentMode,
  viewers,
  liveUrl,
  previewUrl,
  onTitleChange,
  onTitleBlur,
  onSetMobile,
  onSave,
  onSaveAsTemplate,
  onOpenAbTest,
  onPublish,
  onToggleCommentMode,
  onShareForReview,
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

      <Badge
        variant={status === "published" ? "default" : "secondary"}
        className={cn(
          "text-xs shrink-0",
          status === "published" ? "bg-green-500/10 text-green-700 border-green-200" : "",
        )}
      >
        {status === "published" ? "Live" : "Draft"}
      </Badge>

      <div className="flex-1" />

      <div className="flex items-center gap-1 border border-border rounded-lg p-0.5">
        <button
          onClick={() => onSetMobile(false)}
          className={cn(
            "p-1.5 rounded-md transition-colors",
            !isMobile ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Monitor className="w-4 h-4" />
        </button>
        <button
          onClick={() => onSetMobile(true)}
          className={cn(
            "p-1.5 rounded-md transition-colors",
            isMobile ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Smartphone className="w-4 h-4" />
        </button>
      </div>

      <PresenceStrip viewers={viewers} />

      <Button
        variant={commentMode ? "default" : "outline"}
        size="sm"
        className={cn("gap-1.5 text-xs", commentMode && "bg-amber-500 hover:bg-amber-600 text-white")}
        onClick={onToggleCommentMode}
      >
        <MessageSquare className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Comments</span>
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
        <a href={previewUrl} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Preview</span>
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

      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 text-xs text-amber-600 border-amber-200 hover:bg-amber-50"
        onClick={onSaveAsTemplate}
      >
        <Star className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Template</span>
      </Button>

      <Button
        size="sm"
        variant="outline"
        className="gap-1.5 text-xs text-primary border-primary/30 hover:bg-primary/5"
        onClick={onOpenAbTest}
      >
        <FlaskConical className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">A/B Test</span>
      </Button>

      <Button
        size="sm"
        className="gap-1.5 text-xs"
        onClick={onPublish}
        disabled={isSaving}
        variant={status === "published" ? "outline" : "default"}
      >
        <Globe className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{status === "published" ? "Unpublish" : "Publish"}</span>
      </Button>
    </header>
  );
}
