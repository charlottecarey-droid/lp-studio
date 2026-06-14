/**
 * Screenshot attach zone — "or paste / drop a screenshot of a page you like"
 * (June 2026). Shared by CreatePageModal's AI tabs.
 *
 * Split into a hook + a presentational zone because paste handling is
 * modal-scoped (a clipboard image pasted ANYWHERE in the modal while the AI
 * tab is active should attach), while drop/click-to-browse live on the zone
 * itself:
 *
 *   const shot = useScreenshotAttachment();
 *   …onPaste / document paste listener → shot.attachFile(file)
 *   <ScreenshotAttachZone state={shot} />
 *
 * Only ONE screenshot at a time — a new attach replaces the previous one.
 * Files are downscaled client-side (max 1600px long edge, JPEG q0.85) via
 * src/lib/screenshotAttachment before producing the dataURL that goes out as
 * the request body's `screenshotDataUrl`.
 *
 * A11y: the drop target is a real <button> (keyboard browse), the paste hint
 * is part of its accessible name, and attach/remove transitions are announced
 * through an aria-live region.
 */
import { useCallback, useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  downscaleImageFile,
  formatByteSize,
  imageFileFromDataTransfer,
  type AttachedScreenshot,
} from "@/lib/screenshotAttachment";

export interface ScreenshotAttachmentState {
  screenshot: AttachedScreenshot | null;
  processing: boolean;
  error: string | null;
  /** Downscale + attach (replaces any current screenshot). Safe to call from
   *  paste listeners, drop handlers, and the file input alike. */
  attachFile: (file: File) => void;
  remove: () => void;
  /** Clear everything (modal close / form reset). */
  reset: () => void;
}

export function useScreenshotAttachment(): ScreenshotAttachmentState {
  const [screenshot, setScreenshot] = useState<AttachedScreenshot | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Monotonic token so a slow decode can't clobber a newer attach/remove.
  const tokenRef = useRef(0);

  const attachFile = useCallback((file: File) => {
    const token = ++tokenRef.current;
    setProcessing(true);
    setError(null);
    void downscaleImageFile(file)
      .then((shot) => {
        if (tokenRef.current !== token) return;
        setScreenshot(shot); // replace — only one screenshot at a time
        setProcessing(false);
      })
      .catch((err: unknown) => {
        if (tokenRef.current !== token) return;
        setProcessing(false);
        setError(err instanceof Error ? err.message : "Couldn't read that image.");
      });
  }, []);

  const remove = useCallback(() => {
    tokenRef.current++;
    setScreenshot(null);
    setProcessing(false);
    setError(null);
  }, []);

  return { screenshot, processing, error, attachFile, remove, reset: remove };
}

interface ZoneProps {
  state: ScreenshotAttachmentState;
  disabled?: boolean;
  /** Compact variant for tighter modals (smaller paddings/labels). */
  compact?: boolean;
}

export function ScreenshotAttachZone({ state, disabled, compact }: ZoneProps) {
  const { screenshot, processing, error, attachFile, remove } = state;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (disabled) return;
      const file = imageFileFromDataTransfer(e.dataTransfer);
      if (file) attachFile(file);
    },
    [disabled, attachFile],
  );

  return (
    <div>
      {screenshot ? (
        <div
          className={cn(
            "flex items-center gap-2 rounded-md border border-input bg-muted/50 px-2 py-1.5",
            compact ? "text-[11px]" : "text-xs",
          )}
        >
          <img
            src={screenshot.dataUrl}
            alt=""
            aria-hidden
            className="h-8 w-12 shrink-0 rounded-sm border border-border object-cover bg-white"
          />
          <span className="min-w-0 flex-1 truncate" title={screenshot.name}>
            <span className="text-foreground font-medium">{screenshot.name}</span>{" "}
            <span className="text-muted-foreground">({formatByteSize(screenshot.size)})</span>
          </span>
          <button
            type="button"
            aria-label={`Remove screenshot ${screenshot.name}`}
            className="shrink-0 rounded-sm p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={remove}
            disabled={disabled}
          >
            <X className="w-3.5 h-3.5" aria-hidden />
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled || processing}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          aria-label="Attach a screenshot of a page you like — browse files, drop an image here, or paste one anywhere in this dialog"
          className={cn(
            "w-full flex items-center justify-center gap-2 rounded-md border border-dashed text-muted-foreground transition-colors",
            compact ? "px-3 py-2 text-[11px]" : "px-3 py-2.5 text-xs",
            dragOver
              ? "border-primary bg-primary/5 text-foreground"
              : "border-input hover:border-primary/40 hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            (disabled || processing) && "opacity-60 cursor-not-allowed",
          )}
        >
          {processing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
          ) : (
            <ImagePlus className="w-3.5 h-3.5" aria-hidden />
          )}
          <span>
            {processing ? "Processing screenshot…" : "or paste / drop a screenshot of a page you like"}
          </span>
        </button>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) attachFile(f);
          e.target.value = ""; // allow re-picking the same file
        }}
      />
      {error && (
        <p className="mt-1 text-[11px] text-red-600" role="alert">
          {error}
        </p>
      )}
      <p className="mt-1 text-[11px] text-muted-foreground">
        Screenshots beat URLs — we'll match this layout's look as closely as we can.
      </p>
      {/* Announce attach/remove for screen readers (the thumbnail chip itself
          is visual). */}
      <span className="sr-only" role="status" aria-live="polite">
        {screenshot
          ? `Screenshot attached: ${screenshot.name}`
          : processing
            ? "Processing screenshot"
            : ""}
      </span>
    </div>
  );
}
