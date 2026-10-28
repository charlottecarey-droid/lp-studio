import { useState } from "react";
import { ImageIcon, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ImagePicker } from "@/components/ImagePicker";
import { cn } from "@/lib/utils";

/**
 * Builder-only "Add image / Change image" pill for a slot that renders its own
 * designed placeholder when empty (resource thumbnails, posters, hero photos).
 * Unlike <InlineImage>, it does not own the <img>: the host keeps rendering
 * whatever it renders and overlays this button in a corner. Always visible in
 * the editor (never hover-gated — Charlotte: "images are hard to find"), opens
 * the shared ImagePicker (upload · library · URL · generate) in a popover, and
 * offers Remove when an image is set.
 */
export interface InlineImageButtonProps {
  value: string;
  onChange: (url: string) => void;
  /** What the image is, for the popover title + the AI brief ("Resource thumbnail"). */
  label?: string;
  /** Corner of the host. Default top-right. */
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
  /** Icon-only pill (tight spots such as list rows). */
  compact?: boolean;
  /** Render in flow (the host lays it out) instead of pinned to a corner of the host. */
  inline?: boolean;
  className?: string;
  /** Alt-text editor, when the host stores one. */
  alt?: string;
  onAltChange?: (alt: string) => void;
}

const POS: Record<NonNullable<InlineImageButtonProps["position"]>, string> = {
  "top-right": "top-2 right-2",
  "top-left": "top-2 left-2",
  "bottom-right": "bottom-2 right-2",
  "bottom-left": "bottom-2 left-2",
};

export function InlineImageButton({ value, onChange, label = "Image", position = "top-right", compact = false, inline = false, className, alt, onAltChange }: InlineImageButtonProps) {
  const [open, setOpen] = useState(false);
  const has = !!(value ?? "").trim();
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={has ? `Change ${label.toLowerCase()}` : `Add ${label.toLowerCase()}`}
          aria-label={has ? `Change ${label.toLowerCase()}` : `Add ${label.toLowerCase()}`}
          data-inline-image={has ? "change" : "add"}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          className={cn(
            "z-20 inline-flex items-center gap-1.5 rounded-full bg-black/75 text-white shadow-md ring-1 ring-white/20 backdrop-blur transition-colors hover:bg-black/90",
            compact ? "h-8 w-8 justify-center" : "px-2.5 py-1.5 text-[11px] font-semibold",
            inline ? "" : `absolute ${POS[position]}`,
            className,
          )}
        >
          <ImageIcon className="h-3.5 w-3.5" aria-hidden />
          {!compact && (has ? "Change image" : "Add image")}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={6} className="w-80 space-y-3" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
        <ImagePicker
          value={value ?? ""}
          onChange={(url) => {
            onChange(url);
            if (url) setOpen(false);
          }}
          label={has ? `Change ${label.toLowerCase()}` : `Add ${label.toLowerCase()}`}
          aiHint={label}
          placeholder="Upload, pick from the library, or paste a URL"
        />
        {onAltChange && (
          <label className="block space-y-1 border-t pt-2">
            <span className="text-xs font-semibold">Alt text</span>
            <input value={alt ?? ""} onChange={(e) => onAltChange(e.target.value)} placeholder="Describe the image for accessibility" className="h-8 w-full rounded-md border bg-background px-2 text-xs" />
          </label>
        )}
        {has && (
          <button type="button" onClick={() => { onChange(""); setOpen(false); }} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive">
            <X className="h-3 w-3" aria-hidden /> Remove image (back to the designed placeholder)
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
