import { useEffect, useRef, useState } from "react";
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

/**
 * Resolve a `var(--foo, fallback)` color string against a host element's
 * computed style. The popover content is portaled to <body> where the brand
 * CSS variables (set on a wrapper element, not :root) aren't visible — so
 * brand swatches like `var(--brand-primary)` would otherwise render empty
 * and visually overlap. We snapshot real hex values from the trigger (which
 * IS inside the brand scope) at open time.
 */
function resolveSwatchValue(value: string, host: HTMLElement | null): string {
  if (!value || !value.startsWith("var(")) return value;
  if (!host) return value;
  const probe = document.createElement("span");
  probe.style.color = value;
  probe.style.display = "none";
  host.appendChild(probe);
  const resolved = window.getComputedStyle(probe).color;
  host.removeChild(probe);
  return resolved && resolved !== "rgba(0, 0, 0, 0)" ? resolved : value;
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
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const rawSwatches = brandSwatches && brandSwatches.length > 0 ? brandSwatches : FALLBACK_SWATCHES;
  const [resolvedSwatches, setResolvedSwatches] = useState<BrandSwatch[]>(rawSwatches);

  useEffect(() => {
    if (!open) return;
    setRecents(loadRecents());
    // Snapshot real hex for any var(--…) swatches against the trigger,
    // which sits inside the brand-scoped subtree.
    const host = triggerRef.current;
    setResolvedSwatches(
      rawSwatches.map((s) => ({ ...s, value: resolveSwatchValue(s.value, host) })),
    );
  }, [open, rawSwatches]);

  const swatches = resolvedSwatches;

  const apply = (value: string) => {
    onPick(value);
    if (value && !value.startsWith("var(")) {
      const next = [value, ...recents.filter((v) => v !== value)].slice(0, MAX_RECENTS);
      setRecents(next);
      saveRecents(next);
    }
    onOpenChange(false);
  };

  // Explicit inline-grid styling so the layout is bulletproof regardless of
  // ambient Tailwind/CSS — earlier reports of "all colors stacked on top of
  // each other" came from grid-template-columns failing to apply in the
  // portaled subtree.
  const swatchGridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
    gap: "0.375rem",
  };
  const swatchBtnStyle = (bg: string): React.CSSProperties => ({
    width: "1.75rem",
    height: "1.75rem",
    borderRadius: "0.25rem",
    border: "1px solid hsl(var(--border))",
    background: bg || "transparent",
    backgroundImage: bg
      ? undefined
      : "linear-gradient(45deg, #ddd 25%, transparent 25%, transparent 75%, #ddd 75%), linear-gradient(45deg, #ddd 25%, transparent 25%, transparent 75%, #ddd 75%)",
    backgroundSize: bg ? undefined : "8px 8px",
    backgroundPosition: bg ? undefined : "0 0, 4px 4px",
    cursor: "pointer",
    padding: 0,
  });

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <span ref={triggerRef} style={{ display: "inline-flex" }}>
          {children}
        </span>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-64 p-3"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="space-y-3">
          {recents.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                Recent
              </p>
              <div style={swatchGridStyle}>
                {recents.map((v) => (
                  <button
                    key={v}
                    type="button"
                    title={v}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => apply(v)}
                    style={swatchBtnStyle(v)}
                    className="hover:scale-110 transition-transform"
                  />
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
              Brand
            </p>
            <div style={swatchGridStyle}>
              {swatches.map((s) => (
                <button
                  key={s.name + s.value}
                  type="button"
                  title={s.name}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => apply(s.value)}
                  style={swatchBtnStyle(s.value)}
                  className="hover:scale-110 transition-transform"
                />
              ))}
            </div>
          </div>

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
