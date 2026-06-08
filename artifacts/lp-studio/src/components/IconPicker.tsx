import { useMemo, useState } from "react";
import * as LucideIcons from "lucide-react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ImagePicker } from "@/components/ImagePicker";
import { IconOrImage, isImageIcon, type IconComp } from "@/lib/icon-value";

/**
 * Task #1279 — reusable icon control for LP Studio blocks.
 *
 * A single string field that emits EITHER a Lucide icon name (searchable
 * dropdown of every Lucide icon) OR an image URL / data-URI (via the shared
 * ImagePicker — upload, library, paste, or AI generate). Backward compatible:
 * a stored Lucide name keeps showing the icon, a stored URL shows the image.
 */

// Enumerate every Lucide icon name once. Drop the `XIcon` aliases, the
// `Lucide`-prefixed aliases, and the bare `Icon`/`createLucideIcon` exports so
// the list is the canonical PascalCase names the renderers resolve by.
const ALL_ICON_NAMES: string[] = Object.keys(LucideIcons)
  .filter(
    (k) =>
      /^[A-Z][A-Za-z0-9]+$/.test(k) &&
      !k.endsWith("Icon") &&
      k !== "Icon" &&
      !k.startsWith("Lucide"),
  )
  .sort((a, b) => a.localeCompare(b));

const MAX_RESULTS = 60;

interface IconPickerProps {
  /** Current value: a Lucide icon name or an image URL / data-URI. */
  value?: string;
  onChange: (value: string) => void;
  label?: string;
  /** Context phrase for default AI image generation (passed to ImagePicker). */
  aiHint?: string;
  className?: string;
}

function IconCombobox({ value, onChange }: { value?: string; onChange: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const usingImage = isImageIcon(value);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? ALL_ICON_NAMES.filter((n) => n.toLowerCase().includes(q))
      : ALL_ICON_NAMES;
    return list.slice(0, MAX_RESULTS);
  }, [query]);

  const Preview: IconComp = usingImage
    ? LucideIcons.ImageIcon
    : (LucideIcons as unknown as Record<string, IconComp>)[value ?? ""] ?? LucideIcons.Sparkles;
  const triggerLabel = usingImage ? "Custom image" : value || "Choose icon";

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery(""); }}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-8 w-full justify-between gap-1.5 px-2 text-xs font-normal"
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <Preview className="h-3.5 w-3.5 shrink-0 opacity-70" />
            <span className="truncate">{triggerLabel}</span>
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        <div className="flex items-center gap-1.5 border-b px-2.5 py-2">
          <Search className="h-3.5 w-3.5 shrink-0 opacity-50" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search icons…"
            className="h-6 w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {results.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">No icons found.</p>
          ) : (
            results.map((name) => {
              const ItemIcon = (LucideIcons as unknown as Record<string, IconComp>)[name] ?? LucideIcons.Sparkles;
              const selected = !usingImage && value === name;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => { onChange(name); setOpen(false); setQuery(""); }}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground"
                >
                  <ItemIcon className="h-3.5 w-3.5 shrink-0 opacity-80" />
                  <span className="truncate">{name}</span>
                  {selected && <Check className="ml-auto h-3.5 w-3.5 shrink-0" />}
                </button>
              );
            })
          )}
          {query.trim() === "" && ALL_ICON_NAMES.length > MAX_RESULTS && (
            <p className="px-2 py-2 text-center text-[11px] text-muted-foreground">
              Type to search all {ALL_ICON_NAMES.length} icons
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function IconPicker({ value, onChange, label, aiHint, className }: IconPickerProps) {
  const usingImage = isImageIcon(value);
  return (
    <div className={className}>
      {label && (
        <Label className="text-[11px] text-muted-foreground mb-1 block">{label}</Label>
      )}
      <div className="flex items-center gap-1.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-muted/40">
          <IconOrImage value={value} className="h-4 w-4" fallback={LucideIcons.Sparkles} />
        </div>
        <div className="min-w-0 flex-1">
          <IconCombobox value={value} onChange={onChange} />
        </div>
      </div>
      <ImagePicker
        value={usingImage ? (value ?? "") : ""}
        onChange={onChange}
        aiHint={aiHint ?? label ?? "Icon image"}
        placeholder="…or use an image"
        className="mt-1.5"
        previewClassName="w-full h-16 object-contain bg-muted/30"
      />
    </div>
  );
}
