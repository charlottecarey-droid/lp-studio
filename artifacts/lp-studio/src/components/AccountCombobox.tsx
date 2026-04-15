import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Search, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Account {
  id: number;
  name: string;
}

interface Props {
  accounts: Account[];
  value: string | number | "";
  onChange: (value: string) => void;
  placeholder?: string;
  allLabel?: string;
  className?: string;
}

export function AccountCombobox({
  accounts,
  value,
  onChange,
  placeholder = "Select an account…",
  allLabel,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const sorted = useMemo(
    () => [...accounts].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })),
    [accounts],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(a => a.name.toLowerCase().includes(q));
  }, [sorted, search]);

  const selectedName = useMemo(
    () => accounts.find(a => String(a.id) === String(value))?.name ?? "",
    [accounts, value],
  );

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 30);
    else setSearch("");
  }, [open]);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  const displayLabel = value !== "" && value !== null && value !== undefined && selectedName
    ? selectedName
    : allLabel ?? placeholder;

  const isPlaceholder = !value || !selectedName;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={cn(
          "w-full h-10 flex items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-ring",
          open && "ring-2 ring-ring",
          isPlaceholder && "text-muted-foreground",
        )}
      >
        <span className="truncate">{displayLabel}</span>
        <ChevronDown className={cn("w-4 h-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg overflow-hidden">
          {/* Search */}
          <div className="flex items-center gap-2 px-2.5 py-2 border-b border-border">
            <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search accounts…"
              className="flex-1 text-sm bg-transparent focus:outline-none placeholder:text-muted-foreground/60"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Options */}
          <div className="max-h-56 overflow-y-auto">
            {/* "All accounts" / placeholder option */}
            {allLabel !== undefined && (
              <button
                type="button"
                onClick={() => { onChange(""); setOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors",
                  "hover:bg-accent hover:text-accent-foreground",
                  !value && "bg-accent/50 font-medium",
                )}
              >
                <Check className={cn("w-3.5 h-3.5 shrink-0", value ? "invisible" : "text-primary")} />
                <span className="text-muted-foreground italic">{allLabel}</span>
              </button>
            )}

            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-sm text-center text-muted-foreground">No accounts found</p>
            ) : (
              filtered.map(a => {
                const isSelected = String(a.id) === String(value);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => { onChange(String(a.id)); setOpen(false); }}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors",
                      "hover:bg-accent hover:text-accent-foreground",
                      isSelected && "bg-accent/50",
                    )}
                  >
                    <Check className={cn("w-3.5 h-3.5 shrink-0", isSelected ? "text-primary" : "invisible")} />
                    <span className="truncate">{a.name}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
