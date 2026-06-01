import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { gradeBgColor, type ScoreResult } from "@/lib/seo-scoring";

const GRADE_BANDS: { grade: ScoreResult["grade"]; range: string }[] = [
  { grade: "A", range: "90-100" },
  { grade: "B", range: "75-89" },
  { grade: "C", range: "60-74" },
  { grade: "D", range: "40-59" },
  { grade: "F", range: "0-39" },
];

/**
 * Info popover for the Pages-list "Score" column header.
 *
 * The column squeezes two unrelated metrics into one cell, which is the root of
 * the confusion this explains:
 *  - a letter grade = client-side SEO/GEO content-quality score, and
 *  - a number = behavioral performance from the last 30 days of real traffic
 *    (only present once a page has visits).
 */
export function ScoreLegend() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-foreground transition-colors"
          aria-label="What does the Score column mean?"
        >
          <span>Score</span>
          <Info className="w-3 h-3 normal-case" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" side="bottom" className="w-80 p-4 text-left">
        <div className="space-y-3 normal-case tracking-normal">
          <div>
            <p className="text-sm font-semibold text-foreground">About the Score column</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              This column shows two different things.
            </p>
          </div>

          {/* Letter grade */}
          <div className="flex gap-2.5">
            <Badge
              variant="outline"
              className={cn("text-[10px] px-1.5 py-0 font-semibold h-fit mt-0.5", gradeBgColor("B"))}
            >
              B
            </Badge>
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground">Letter grade (A-F)</p>
              <p className="text-[11px] text-muted-foreground leading-snug">
                SEO/GEO content quality, scored from the page's content and metadata
                (headline, structure, social proof, stats, meta tags). Shown on every page.
              </p>
            </div>
          </div>

          {/* Behavioral number */}
          <div className="flex gap-2.5">
            <span className="text-[11px] font-semibold tabular-nums text-emerald-600 h-fit mt-0.5 w-[18px] text-center shrink-0">
              72
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground">Performance number (0-100)</p>
              <p className="text-[11px] text-muted-foreground leading-snug">
                How the page actually performs — visitor conversion, scroll depth and
                engagement over the last 30 days. Only appears once a page has real traffic.
              </p>
            </div>
          </div>

          {/* Grade bands */}
          <div className="border-t border-border/60 pt-2.5">
            <p className="text-[11px] font-medium text-foreground mb-1.5">Grade thresholds</p>
            <div className="flex flex-wrap gap-1.5">
              {GRADE_BANDS.map(({ grade, range }) => (
                <span key={grade} className="inline-flex items-center gap-1">
                  <Badge
                    variant="outline"
                    className={cn("text-[10px] px-1.5 py-0 font-semibold", gradeBgColor(grade))}
                  >
                    {grade}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground tabular-nums">{range}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
