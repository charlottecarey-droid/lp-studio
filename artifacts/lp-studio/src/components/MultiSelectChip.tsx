import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";

interface Props {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  className?: string;
}

export function MultiSelectChip({ label, options, selected, onChange, className }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  function toggle(v: string) {
    if (selected.includes(v)) onChange(selected.filter(x => x !== v));
    else onChange([...selected, v]);
  }

  const summary = selected.length === 0
    ? label
    : selected.length === 1
      ? `${label}: ${selected[0]}`
      : `${label} · ${selected.length}`;

  return (
    <div ref={ref} className={`relative ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        disabled={options.length === 0}
        className={`h-9 px-3 rounded-md border bg-background text-sm flex items-center gap-2 w-full justify-between
          ${selected.length > 0 ? "border-primary/40 bg-primary/5" : "border-input"}
          disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <span className="truncate">{summary}</span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {selected.length > 0 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange([]); }}
              className="p-0.5 rounded hover:bg-muted text-muted-foreground"
              aria-label={`Clear ${label}`}
            >
              <X className="w-3 h-3" />
            </button>
          )}
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
      </button>
      {open && options.length > 0 && (
        <div className="absolute z-50 mt-1 w-full min-w-[180px] max-h-64 overflow-y-auto rounded-md border border-border bg-popover shadow-lg py-1">
          {options.map(opt => {
            const checked = selected.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => toggle(opt)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted/60 text-left"
              >
                <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0
                  ${checked ? "bg-primary border-primary" : "border-input"}`}>
                  {checked && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                </div>
                <span className="truncate">{opt}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
