import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Status = "draft" | "running" | "paused" | "completed";

export function StatusBadge({ status, className }: { status: Status | string; className?: string }) {
  const variants: Record<string, string> = {
    draft: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800",
    running: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900",
    paused: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900",
    completed: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900",
  };

  const labels: Record<string, string> = {
    draft: "Draft",
    running: "Running",
    paused: "Paused",
    completed: "Completed",
  };

  const activeClass = variants[status] || variants.draft;
  const label = labels[status] || status;

  return (
    <Badge 
      variant="outline" 
      className={cn(
        "font-semibold tracking-wide uppercase text-[10px] px-2.5 py-0.5 shadow-sm", 
        activeClass, 
        className
      )}
    >
      {label}
    </Badge>
  );
}
