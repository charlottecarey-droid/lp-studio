import type { RefObject } from "react";
import { Link } from "wouter";
import {
  ArrowLeft, Save, Globe, Copy, Monitor, Smartphone, CheckCircle, FlaskConical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface BuilderTopBarProps {
  title: string;
  titleRef: RefObject<HTMLInputElement>;
  status: "draft" | "published";
  isMobile: boolean;
  isSaving: boolean;
  saveSuccess: boolean;
  onTitleChange: (title: string) => void;
  onTitleBlur: () => void;
  onSetMobile: (mobile: boolean) => void;
  onCopyLink: () => void;
  onSave: () => void;
  onOpenAbTest: () => void;
  onPublish: () => void;
}

export function BuilderTopBar({
  title,
  titleRef,
  status,
  isMobile,
  isSaving,
  saveSuccess,
  onTitleChange,
  onTitleBlur,
  onSetMobile,
  onCopyLink,
  onSave,
  onOpenAbTest,
  onPublish,
}: BuilderTopBarProps) {
  return (
    <header className="h-14 flex items-center gap-3 px-4 border-b border-border bg-background/80 backdrop-blur-xl shrink-0">
      <Link href="/pages">
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline text-xs">Pages</span>
        </Button>
      </Link>

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

      <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={onCopyLink}>
        <Copy className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Copy Link</span>
      </Button>

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
