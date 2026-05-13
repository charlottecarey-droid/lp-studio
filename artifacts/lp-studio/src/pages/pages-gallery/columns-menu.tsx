import { Columns3, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ColumnVisibility } from "./types";

interface Props {
  visibility: ColumnVisibility;
  setVisibility: (v: ColumnVisibility) => void;
}

const OPTIONS: Array<{ key: keyof ColumnVisibility; label: string; hint: string }> = [
  { key: "lastEdited", label: "Last edited", hint: "Who last edited the page" },
  { key: "createdBy", label: "Created by", hint: "Who originally created the page" },
  { key: "author", label: "Author", hint: "Combined author column (last editor or creator)" },
];

export function ColumnsMenu({ visibility, setVisibility }: Props) {
  const visibleCount = OPTIONS.filter(o => visibility[o.key]).length;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-[13px] rounded-lg"
          title="Show or hide table columns"
        >
          <Columns3 className="w-3.5 h-3.5" />
          Columns
          {visibleCount > 0 && (
            <span className="ml-0.5 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded text-[10px] font-semibold bg-foreground/10 text-foreground/70 tabular-nums">
              {visibleCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground/70">
          Optional columns
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {OPTIONS.map(opt => {
          const checked = visibility[opt.key];
          return (
            <button
              key={opt.key}
              type="button"
              role="menuitemcheckbox"
              aria-checked={checked}
              onClick={() => setVisibility({ ...visibility, [opt.key]: !checked })}
              className="w-full flex items-start gap-2 px-2 py-1.5 text-left text-[13px] rounded-sm hover:bg-muted/60 transition-colors cursor-pointer"
            >
              <span className="w-4 h-4 mt-0.5 rounded border border-border flex items-center justify-center shrink-0 bg-background">
                {checked && <Check className="w-3 h-3 text-foreground" />}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-foreground">{opt.label}</span>
                <span className="block text-[11px] text-muted-foreground/70 leading-tight">
                  {opt.hint}
                </span>
              </span>
            </button>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
