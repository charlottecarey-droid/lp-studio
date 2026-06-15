/**
 * GenerationStageRail — the left-hand pipeline progress list shown while a live
 * generation streams (June 2026). Extracted from GenerationLiveView so the
 * sales microsite generator shows the same stage rail. Purely presentational:
 * the caller owns stream state and passes the stage map + reference metadata.
 */
import { AlertTriangle, Check, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  hostOf,
  type GenerationStageDef,
  type RefsMeta,
  type StageStatus,
} from "./liveBlocks";
import type { GenerationStageId } from "@/lib/generationStream";

export interface GenerationStageRailProps {
  /** Stages to display (order = display order). Marketing passes all six; the
   *  microsite path omits "polish". */
  stageDefs: GenerationStageDef[];
  stageState: Record<GenerationStageId, StageStatus>;
  stageLabels: Partial<Record<GenerationStageId, string>>;
  refsMeta: RefsMeta | null;
  elapsed: number;
  onCancel: () => void;
  /** Footer reassurance line. Defaults to "Usually under a minute." */
  hint?: string;
}

export function GenerationStageRail({
  stageDefs,
  stageState,
  stageLabels,
  refsMeta,
  elapsed,
  onCancel,
  hint = "Usually under a minute.",
}: GenerationStageRailProps) {
  return (
    <div className="p-4 space-y-4">
      {/* aria-live so screen readers hear each stage label as it starts/completes. */}
      <ol className="space-y-3" aria-live="polite" aria-label="Generation progress">
        {stageDefs.map((def) => {
          const status = stageState[def.id];
          const label = stageLabels[def.id] ?? def.label;
          return (
            <li key={def.id} className="flex items-start gap-2.5">
              <span className="mt-0.5 w-4 h-4 flex items-center justify-center shrink-0">
                {status === "done" ? (
                  <Check className="w-4 h-4 text-primary" aria-hidden />
                ) : status === "active" ? (
                  <Loader2
                    className="w-4 h-4 text-primary animate-spin motion-reduce:animate-none"
                    aria-hidden
                  />
                ) : (
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40"
                    aria-hidden
                  />
                )}
              </span>
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-xs leading-snug",
                    status === "pending" && "text-muted-foreground",
                    status === "active" && "text-foreground font-medium",
                    status === "done" && "text-foreground/80",
                  )}
                >
                  {label}
                  <span className="sr-only">
                    {status === "done" ? " — done" : status === "active" ? " — in progress" : ""}
                  </span>
                </p>
                {def.id === "references" && refsMeta && (
                  <ul className="mt-1.5 space-y-1">
                    {refsMeta.scraped.map((u) => (
                      <li
                        key={u}
                        className="flex items-center gap-1 text-[11px] text-muted-foreground truncate"
                        title={u}
                      >
                        <Check className="w-3 h-3 text-primary shrink-0" aria-hidden />
                        <span className="truncate">{hostOf(u)}</span>
                      </li>
                    ))}
                    {refsMeta.failed.map((f) => (
                      <li
                        key={f.url}
                        className="flex items-center gap-1 text-[11px] text-amber-600 truncate"
                        title={`${f.url} — ${f.reason}`}
                      >
                        <AlertTriangle className="w-3 h-3 shrink-0" aria-hidden />
                        <span className="truncate">
                          {hostOf(f.url)} ({f.reason.replace(/_/g, " ")})
                        </span>
                      </li>
                    ))}
                    {refsMeta.fromInspiration.map((u) => (
                      <li
                        key={`insp:${u}`}
                        className="flex items-center gap-1 text-[11px] text-muted-foreground/80 truncate"
                        title={`${u} (inspiration site)`}
                      >
                        <Sparkles className="w-3 h-3 shrink-0" aria-hidden />
                        <span className="truncate">{hostOf(u)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="pt-2 border-t border-border space-y-1.5">
        <p className="text-[11px] text-muted-foreground tabular-nums">
          Elapsed: {Math.floor(elapsed / 60) > 0 ? `${Math.floor(elapsed / 60)}m ` : ""}
          {elapsed % 60}s
        </p>
        <p className="text-[11px] text-muted-foreground/80">{hint}</p>
      </div>

      <Button variant="outline" size="sm" className="w-full" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}
