import { useLocation } from "wouter";
import { Plus, FileText, Store, Sparkles, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/AuthContext";

interface NewLauncherProps {
  size?: "sm" | "default";
  variant?: "default" | "outline";
  className?: string;
}

/**
 * Single source of truth for "create new" actions across the app.
 * Replaces ad-hoc "+ New Page" / "+ New Experiment" buttons that existed
 * on the dashboard, sidebar, and gallery — all of which had subtly
 * different starting points (blank vs brief vs experiment).
 */
export function NewLauncher({
  size = "sm",
  variant = "default",
  className,
}: NewLauncherProps) {
  const [, navigate] = useLocation();
  const { hasPerm } = useAuth();

  const canPages = hasPerm("pages");
  const canTests = hasPerm("tests");

  // If the user can't do anything, render nothing rather than a dead button.
  if (!canPages && !canTests) return null;

  const go = (href: string) => navigate(href);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size={size} variant={variant} className={className}>
          <Plus className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
          New
          <ChevronDown className="w-3 h-3 ml-1 opacity-70" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        {canPages && (
          <>
            <DropdownMenuItem onClick={() => go("/pages?new=ai")} className="gap-2.5 py-2.5">
              <Sparkles className="w-4 h-4 text-violet-500 shrink-0" />
              <div className="flex-1">
                <div className="text-sm font-medium">With AI</div>
                <div className="text-[11px] text-muted-foreground">Describe the page, get a draft</div>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => go("/pages?new=brief")} className="gap-2.5 py-2.5">
              <FileText className="w-4 h-4 text-violet-500 shrink-0" />
              <div className="flex-1">
                <div className="text-sm font-medium">From a brief</div>
                <div className="text-[11px] text-muted-foreground">Answer a few questions, get a draft</div>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => go("/templates")} className="gap-2.5 py-2.5">
              <Store className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1">
                <div className="text-sm font-medium">From a template</div>
                <div className="text-[11px] text-muted-foreground">Browse and clone</div>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => go("/pages?new=template")} className="gap-2.5 py-2.5">
              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1">
                <div className="text-sm font-medium">Blank page</div>
                <div className="text-[11px] text-muted-foreground">Start from scratch</div>
              </div>
            </DropdownMenuItem>
          </>
        )}
        {canPages && canTests && <DropdownMenuSeparator />}
        {canTests && (
          <DropdownMenuItem onClick={() => go("/tests/new")} className="gap-2.5 py-2.5">
            <Plus className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="flex-1">
              <div className="text-sm font-medium">New test</div>
              <div className="text-[11px] text-muted-foreground">A/B test or variant</div>
            </div>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
