import { useRef, useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FocalPointPickerProps {
  /** CSS object-position string, e.g. "50% 50%" */
  value?: string;
  onChange: (value: string) => void;
  label?: string;
  /** Optional preview image URL — when provided, a draggable pin appears on
   *  top of it so the user can fine-tune the focal point visually. */
  previewUrl?: string;
}

/** Parses a "X% Y%" focal point string. Falls back to (50, 50). */
function parseFocal(value?: string): { x: number; y: number } {
  if (!value) return { x: 50, y: 50 };
  const m = value.match(/(-?\d+(?:\.\d+)?)\s*%\s+(-?\d+(?:\.\d+)?)\s*%/);
  if (!m) return { x: 50, y: 50 };
  return {
    x: Math.max(0, Math.min(100, parseFloat(m[1]))),
    y: Math.max(0, Math.min(100, parseFloat(m[2]))),
  };
}

const PRESETS: { x: number; y: number; key: string; title: string }[] = [
  { x: 0, y: 0, key: "tl", title: "Top left" },
  { x: 50, y: 0, key: "tc", title: "Top center" },
  { x: 100, y: 0, key: "tr", title: "Top right" },
  { x: 0, y: 50, key: "ml", title: "Middle left" },
  { x: 50, y: 50, key: "mc", title: "Center" },
  { x: 100, y: 50, key: "mr", title: "Middle right" },
  { x: 0, y: 100, key: "bl", title: "Bottom left" },
  { x: 50, y: 100, key: "bc", title: "Bottom center" },
  { x: 100, y: 100, key: "br", title: "Bottom right" },
];

/**
 * 3x3 grid + draggable pin replacement for the legacy "type 50% 50%" focal
 * point input (task #266). Calls `onChange` with a normalized "X% Y%"
 * string whenever the user picks a preset or drags the pin.
 */
export function FocalPointPicker({ value, onChange, label, previewUrl }: FocalPointPickerProps) {
  const { x, y } = parseFocal(value);
  const previewRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const setFocal = (nx: number, ny: number) => {
    const cx = Math.round(Math.max(0, Math.min(100, nx)));
    const cy = Math.round(Math.max(0, Math.min(100, ny)));
    onChange(`${cx}% ${cy}%`);
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const el = previewRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 100;
      const ny = ((e.clientY - rect.top) / rect.height) * 100;
      setFocal(nx, ny);
    };
    const onUp = () => setDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-2">
      {label && <Label className="text-xs">{label}</Label>}

      <div className="flex items-start gap-3">
        {/* 3x3 grid preset picker */}
        <div className="grid grid-cols-3 gap-1 p-1 rounded-md border border-border bg-muted/30 shrink-0" data-testid="focal-grid">
          {PRESETS.map(p => {
            const active = Math.round(x / 50) * 50 === p.x && Math.round(y / 50) * 50 === p.y;
            return (
              <button
                key={p.key}
                type="button"
                title={p.title}
                onClick={() => setFocal(p.x, p.y)}
                className={cn(
                  "w-5 h-5 rounded-sm border transition-colors flex items-center justify-center",
                  active
                    ? "bg-[var(--brand-primary)] border-[var(--brand-primary)]"
                    : "bg-background border-border hover:border-[var(--brand-primary)]/60",
                )}
              >
                {active && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
              </button>
            );
          })}
        </div>

        {/* Live preview with draggable pin (only when an image is provided) */}
        {previewUrl ? (
          <div
            ref={previewRef}
            className="relative flex-1 h-20 rounded-md overflow-hidden border border-border bg-muted/40 cursor-crosshair select-none"
            onMouseDown={(e) => {
              const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
              const nx = ((e.clientX - rect.left) / rect.width) * 100;
              const ny = ((e.clientY - rect.top) / rect.height) * 100;
              setFocal(nx, ny);
              setDragging(true);
            }}
          >
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: `url(${previewUrl})`,
                backgroundSize: "cover",
                backgroundPosition: `${x}% ${y}%`,
              }}
            />
            <div
              className="absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md ring-2 ring-black/40 pointer-events-none"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                background: "var(--brand-primary, #C7E738)",
              }}
            />
          </div>
        ) : (
          <div className="flex-1 self-center">
            <p className="text-[11px] text-muted-foreground leading-snug">
              Pick a starting focal point. Add a background image to fine-tune
              with a draggable pin.
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground font-mono">{Math.round(x)}% {Math.round(y)}%</p>
        {value && value !== "50% 50%" && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
            onClick={() => setFocal(50, 50)}
          >
            Reset to center
          </Button>
        )}
      </div>
    </div>
  );
}
