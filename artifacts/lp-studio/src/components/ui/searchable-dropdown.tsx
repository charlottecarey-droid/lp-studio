import { useState, useRef, useEffect, type ReactNode } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";

export interface DropdownItem {
  id: number;
  label: string;
  /** Optional secondary line (title, email, etc.) */
  secondary?: string;
  /** Optional tertiary line */
  tertiary?: string;
}

interface SearchableDropdownProps {
  items: DropdownItem[];
  loading?: boolean;
  placeholder?: string;
  search: string;
  onSearchChange: (value: string) => void;
  onSelect: (id: number) => void;
  /** Currently selected item — when set, shows a "pill" instead of the combobox */
  selected?: { label: string; secondary?: string; tertiary?: string } | null;
  onClear?: () => void;
  /** Label shown above the dropdown (e.g. "Step 1: Select Account") */
  label?: string;
  /** Override the "No results" message */
  emptyMessage?: string;
  /** Render custom content inside each dropdown item */
  renderItem?: (item: DropdownItem, index: number) => ReactNode;
}

export function SearchableDropdown({
  items,
  loading = false,
  placeholder = "Search…",
  search,
  onSearchChange,
  onSelect,
  selected,
  onClear,
  label,
  emptyMessage,
  renderItem,
}: SearchableDropdownProps) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="space-y-2">
      {label && (
        <label className="text-sm font-semibold text-foreground">{label}</label>
      )}

      {selected ? (
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border bg-muted/30">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground leading-tight">
              {selected.label}
            </p>
            {selected.secondary && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {selected.secondary}
              </p>
            )}
            {selected.tertiary && (
              <p className="text-xs text-muted-foreground truncate">
                {selected.tertiary}
              </p>
            )}
          </div>
          {onClear && (
            <button
              onClick={() => { onClear(); setOpen(true); }}
              className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Change selection"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        <div ref={boxRef} className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder={placeholder}
              value={search}
              onChange={(e) => { onSearchChange(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              className="w-full pl-9"
              disabled={loading}
              autoComplete="off"
            />
            {loading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
            )}
          </div>

          {open && !loading && items.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg overflow-hidden max-h-72 overflow-y-auto">
              {items.map((item, i) => (
                <button
                  key={item.id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSelect(item.id);
                    setOpen(false);
                  }}
                  className={[
                    "w-full text-left px-3 py-2.5 hover:bg-muted/70 transition-colors",
                    i > 0 ? "border-t border-border/50" : "",
                  ].join(" ")}
                >
                  {renderItem ? (
                    renderItem(item, i)
                  ) : (
                    <>
                      <p className="text-sm font-medium text-foreground leading-tight">
                        {item.label}
                      </p>
                      {item.secondary && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {item.secondary}
                        </p>
                      )}
                      {item.tertiary && (
                        <p className="text-xs text-muted-foreground">
                          {item.tertiary}
                        </p>
                      )}
                    </>
                  )}
                </button>
              ))}
            </div>
          )}

          {open && !loading && items.length === 0 && search && (
            <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg px-3 py-3">
              <p className="text-sm text-muted-foreground">
                {emptyMessage ?? `No results for "${search}"`}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
