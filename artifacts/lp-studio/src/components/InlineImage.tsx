import { useState, useRef, ImgHTMLAttributes, CSSProperties, DragEvent } from "react";
import { ImageIcon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ImagePicker } from "@/components/ImagePicker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface InlineImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "onChange"> {
  src: string;
  alt: string;
  onUpdate?: (url: string) => void;
  /** Optional alt-text setter. When provided, the popover shows an alt-text editor. */
  onAltUpdate?: (alt: string) => void;
  /** Current focal-point as `"x% y%"` (CSS object-position). Default `"50% 50%"`. */
  focalPoint?: string;
  /** Optional focal-point setter. When provided, the popover shows a focal-point picker
   *  and the image is rendered with `object-position: <focalPoint>`. */
  onFocalUpdate?: (focal: string) => void;
  className?: string;
  style?: CSSProperties;
  /** Optional wrapper className applied to the relative positioning shell. */
  wrapperClassName?: string;
}

/**
 * Builder-aware <img>. When `onUpdate` is provided:
 *   - hovering the image reveals a "Replace" button
 *   - dragging an image file onto the image uploads + replaces in place
 *   - the popover also exposes an alt-text input (when `onAltUpdate` is set)
 */
export function InlineImage({
  src,
  alt,
  onUpdate,
  onAltUpdate,
  focalPoint,
  onFocalUpdate,
  className,
  style,
  wrapperClassName,
  ...imgProps
}: InlineImageProps) {
  const focal = focalPoint ?? "50% 50%";
  const mergedStyle: CSSProperties = onFocalUpdate
    ? { ...style, objectPosition: focal }
    : style ?? {};
  const [open, setOpen] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const dragDepthRef = useRef(0);

  if (!onUpdate) {
    return (
      <img src={src} alt={alt} className={className} style={mergedStyle} {...imgProps} />
    );
  }

  const uploadDroppedFile = async (file: File) => {
    setUploadError(null);
    if (!file.type.startsWith("image/")) {
      setUploadError("Only image files are supported.");
      return;
    }
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/lp/upload-image", { method: "POST", body: fd });
      if (!res.ok) {
        // Fall back to data URL so the drop still works in dev/test env.
        const reader = new FileReader();
        reader.onload = () => onUpdate(typeof reader.result === "string" ? reader.result : "");
        reader.readAsDataURL(file);
        return;
      }
      const data = (await res.json()) as { url?: string };
      if (data.url) onUpdate(data.url);
    } catch {
      const reader = new FileReader();
      reader.onload = () => onUpdate(typeof reader.result === "string" ? reader.result : "");
      reader.readAsDataURL(file);
    }
  };

  const handleDragEnter = (e: DragEvent<HTMLSpanElement>) => {
    if (!Array.from(e.dataTransfer.types).includes("Files")) return;
    e.preventDefault();
    dragDepthRef.current += 1;
    setIsDraggingFile(true);
  };
  const handleDragLeave = () => {
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDraggingFile(false);
  };
  const handleDragOver = (e: DragEvent<HTMLSpanElement>) => {
    if (!Array.from(e.dataTransfer.types).includes("Files")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };
  const handleDrop = (e: DragEvent<HTMLSpanElement>) => {
    if (!Array.from(e.dataTransfer.types).includes("Files")) return;
    e.preventDefault();
    dragDepthRef.current = 0;
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void uploadDroppedFile(file);
  };

  return (
    <span
      className={cn("relative inline-block group", wrapperClassName)}
      style={{ lineHeight: 0 }}
      onClick={(e: React.MouseEvent) => e.stopPropagation()}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <img src={src} alt={alt} className={className} style={mergedStyle} {...imgProps} />
      {isDraggingFile && (
        <span
          className="absolute inset-0 z-20 flex items-center justify-center rounded-md border-2 border-dashed border-primary bg-primary/10 text-xs font-semibold text-primary pointer-events-none"
          style={{ lineHeight: 1 }}
        >
          Drop image to replace
        </span>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            title="Replace image"
            className={cn(
              "absolute top-2 right-2 z-10 inline-flex items-center gap-1 rounded-md bg-black/70 px-2 py-1 text-xs font-medium text-white shadow",
              "opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
            )}
          >
            <ImageIcon className="w-3 h-3" />
            Replace
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={6}
          className="w-80 space-y-3"
          onClick={(e) => e.stopPropagation()}
        >
          <ImagePicker
            value={src}
            onChange={(url) => {
              onUpdate(url);
              setOpen(false);
            }}
            label="Replace image"
          />
          {onAltUpdate && (
            <div className="space-y-1.5 pt-1 border-t">
              <Label htmlFor="alt-text" className="text-xs font-semibold">Alt text</Label>
              <Input
                id="alt-text"
                value={alt}
                onChange={(e) => onAltUpdate(e.target.value)}
                placeholder="Describe the image for accessibility"
                className="h-8 text-xs"
              />
            </div>
          )}
          {onFocalUpdate && (
            <FocalPointEditor
              src={src}
              focal={focal}
              onChange={onFocalUpdate}
            />
          )}
          {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
          <p className="text-[10px] text-muted-foreground">
            Tip: drop an image file onto the picture to replace it instantly.
          </p>
        </PopoverContent>
      </Popover>
    </span>
  );
}

/**
 * Click-to-set focal point editor. Renders a thumbnail of the image with a
 * crosshair marker; click anywhere on the image to set
 * `object-position: <x>% <y>%` for the live <img>.
 */
function FocalPointEditor({
  src,
  focal,
  onChange,
}: {
  src: string;
  focal: string;
  onChange: (next: string) => void;
}) {
  const [x, y] = parseFocal(focal);
  return (
    <div className="space-y-1.5 pt-1 border-t">
      <Label className="text-xs font-semibold">Focal point</Label>
      <button
        type="button"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - rect.left) / rect.width) * 100;
          const py = ((e.clientY - rect.top) / rect.height) * 100;
          onChange(`${clamp01(px).toFixed(0)}% ${clamp01(py).toFixed(0)}%`);
        }}
        className="relative block w-full overflow-hidden rounded border border-border"
        style={{ aspectRatio: "16 / 9" }}
        title="Click to set focal point"
      >
        <img
          src={src}
          alt=""
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        />
        <span
          className="absolute z-10 w-4 h-4 -ml-2 -mt-2 rounded-full border-2 border-white bg-primary shadow"
          style={{ left: `${x}%`, top: `${y}%` }}
        />
      </button>
      <p className="text-[10px] text-muted-foreground">
        Sets <code>object-position: {focal}</code>.
      </p>
    </div>
  );
}

function parseFocal(s: string): [number, number] {
  const m = s.match(/(-?\d+(?:\.\d+)?)\s*%\s+(-?\d+(?:\.\d+)?)\s*%/);
  if (!m) return [50, 50];
  return [clamp01(Number(m[1])), clamp01(Number(m[2]))];
}
function clamp01(n: number): number {
  return Math.max(0, Math.min(100, n));
}
