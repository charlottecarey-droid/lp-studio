import type { AiMode } from "@/lib/block-governance-client";
import type { AudienceSegment } from "@/lib/brand-config";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * Shared per-block governance controls (task #6 — governance surfaced inside
 * the Block Defaults editor as well as the standalone governance panel). One
 * source of truth so the two surfaces never drift: an Enabled toggle (builder
 * visibility), an AI-mode select (Locked / Copy only / Open), and a checkbox
 * per brand segment (segment approval).
 *
 * `layout="row"` is the dense horizontal form used by the standalone catalog
 * list; `layout="stack"` is the vertical form that fits the narrow property
 * panel column in the Block Defaults editor.
 */

export type WorkingGovernanceEntry = {
  enabled: boolean | null;
  aiMode: AiMode;
  segments: Set<string>;
};

export const AI_MODE_LABELS: Record<AiMode, string> = {
  locked: "Locked (place only)",
  copy: "Copy only",
  open: "Open (default)",
};

/** A governance entry is "default" (no override) when nothing is customized. */
export function isDefaultGovernanceEntry(e: WorkingGovernanceEntry): boolean {
  return e.enabled === null && e.aiMode === "open" && e.segments.size === 0;
}

export function BlockGovernanceControls({
  entry,
  segments,
  onChange,
  layout = "row",
  enableLabel,
}: {
  entry: WorkingGovernanceEntry;
  segments: AudienceSegment[];
  onChange: (next: WorkingGovernanceEntry) => void;
  layout?: "row" | "stack";
  /** Accessible label for the enable switch (e.g. the block label). */
  enableLabel?: string;
}) {
  const enabled = entry.enabled !== false;
  const stacked = layout === "stack";

  return (
    <div
      className={cn(
        stacked
          ? "flex flex-col gap-4"
          : "flex flex-wrap items-center gap-x-6 gap-y-3",
      )}
    >
      <div className={cn("flex items-center gap-3", stacked ? "justify-between" : "min-w-[200px] flex-1")}>
        <div className="flex items-center gap-3 min-w-0">
          <Switch
            checked={enabled}
            onCheckedChange={(checked) =>
              onChange({ ...entry, segments: new Set(entry.segments), enabled: checked ? null : false })
            }
            aria-label={enableLabel ? `Enable ${enableLabel}` : "Enable block"}
          />
          <div className="min-w-0">
            <p className="text-sm font-medium">Enabled in builder</p>
            {stacked && (
              <p className="text-[10px] text-muted-foreground">
                When off, this block is hidden from the builder.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className={cn("flex gap-2", stacked ? "flex-col" : "items-center")}>
        <span className={cn("text-muted-foreground", stacked ? "text-[11px] font-medium" : "text-[11px]")}>
          {stacked ? "AI editing" : "AI"}
        </span>
        <Select
          value={entry.aiMode}
          onValueChange={(v) =>
            onChange({ ...entry, segments: new Set(entry.segments), aiMode: v as AiMode })
          }
        >
          <SelectTrigger className={cn("h-8 text-xs", stacked ? "w-full" : "w-[180px]")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(["locked", "copy", "open"] as AiMode[]).map((m) => (
              <SelectItem key={m} value={m} className="text-xs">
                {AI_MODE_LABELS[m]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {segments.length > 0 && (
        <div className={cn(stacked ? "flex flex-col gap-2" : "flex flex-wrap items-center gap-x-4 gap-y-1.5")}>
          {stacked && (
            <span className="text-[11px] font-medium text-muted-foreground">Segment approval</span>
          )}
          <div className={cn(stacked ? "flex flex-col gap-1.5" : "flex flex-wrap items-center gap-x-4 gap-y-1.5")}>
            {segments.map((seg) => {
              const sid = String(seg.id);
              const checked = entry.segments.has(sid);
              return (
                <label key={sid} className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(c) => {
                      const nextSegs = new Set(entry.segments);
                      if (c) nextSegs.add(sid);
                      else nextSegs.delete(sid);
                      onChange({ ...entry, segments: nextSegs });
                    }}
                  />
                  <span className="truncate max-w-[160px]">{seg.name}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
