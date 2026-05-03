import { useEffect, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

interface BrandSwatch {
  name: string;
  value: string;
}

interface Props {
  children: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (value: string) => void;
  /** Brand-derived swatches to surface at the top of the picker. */
  brandSwatches?: BrandSwatch[];
}

const RECENTS_KEY = "lp-studio:inline-color-recents";
const MAX_RECENTS = 6;

const FALLBACK_SWATCHES: BrandSwatch[] = [
  { name: "Brand", value: "var(--brand-primary)" },
  { name: "Accent", value: "var(--brand-accent)" },
  { name: "Slate", value: "#0F172A" },
  { name: "Muted", value: "#64748B" },
  { name: "White", value: "#FFFFFF" },
  { name: "Blue", value: "#2563EB" },
  { name: "Green", value: "#16A34A" },
  { name: "Amber", value: "#D97706" },
  { name: "Rose", value: "#E11D48" },
];

function loadRecents(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (Array.isArray(parsed)) {
      return parsed.filter((v): v is string => typeof v === "string").slice(0, MAX_RECENTS);
    }
  } catch {
    // Storage may be disabled (private mode, quota); recents simply won't persist.
  }
  return [];
}

function saveRecents(list: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(list.slice(0, MAX_RECENTS)));
  } catch {
    // Ignore storage failures.
  }
}

export function InlineColorPopover({
  children,
  open,
  onOpenChange,
  onPick,
  brandSwatches,
}: Props) {
  const [recents, setRecents] = useState<string[]>([]);
  const [custom, setCustom] = useState("#000000");

  useEffect(() => {
    if (open) setRecents(loadRecents());
  }, [open]);

  const swatches = brandSwatches && brandSwatches.length > 0 ? brandSwatches : FALLBACK_SWATCHES;

  const apply = (value: string) => {
    onPick(value);
    if (value && !value.startsWith("var(")) {
      const next = [value, ...recents.filter((v) => v !== value)].slice(0, MAX_RECENTS);
      setRecents(next);
      saveRecents(next);
    }
    onOpenChange(false);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-64 p-3"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="space-y-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
              Brand
            </p>
            <div className="grid grid-cols-6 gap-1.5">
              {swatches.map((s) => (
                <button
                  key={s.name + s.value}
                  type="button"
                  title={s.name}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => apply(s.value)}
                  className="w-7 h-7 rounded border border-border hover:scale-110 transition-transform"
                  style={{ background: s.value }}
                />
              ))}
            </div>
          </div>

          {recents.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                Recent
              </p>
              <div className="grid grid-cols-6 gap-1.5">
                {recents.map((v) => (
                  <button
                    key={v}
                    type="button"
                    title={v}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => apply(v)}
                    className="w-7 h-7 rounded border border-border hover:scale-110 transition-transform"
                    style={{ background: v }}
                  />
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
              Custom
            </p>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                onMouseDown={(e) => e.stopPropagation()}
                className="w-8 h-8 rounded border border-border cursor-pointer bg-transparent"
              />
              <Input
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                onMouseDown={(e) => e.stopPropagation()}
                className="h-8 text-xs flex-1 font-mono"
              />
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => apply(custom)}
                className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:opacity-90"
              >
                Apply
              </button>
            </div>
          </div>

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => apply("")}
            className="w-full text-xs text-muted-foreground hover:text-foreground py-1"
          >
            Clear color
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
