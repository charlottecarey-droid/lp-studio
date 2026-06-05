// Task #967 — shared affordances for editing a page's / tenant's Open Graph
// "share card" (the preview link previews render in Slack, iMessage, LinkedIn,
// etc.). Used by BOTH the per-page SEO panel (BuilderEditor) and the tenant
// "Default share card" panel (brand-settings) so the two surfaces stay in
// lockstep. Pure presentational + a single upload call — no app-specific state.
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, AlertTriangle, Crop, ImageIcon, Check, Undo2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/** Canonical share-card dimensions the whole OG flow standardises on. Mirrors
 *  OG_IMAGE_WIDTH/HEIGHT in the api-server resolver. */
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;
const OG_ASPECT = OG_IMAGE_WIDTH / OG_IMAGE_HEIGHT;

type Band = "empty" | "good" | "warn" | "bad";

const BAND_COLOR: Record<Band, string> = {
  empty: "text-muted-foreground",
  good: "text-emerald-600 dark:text-emerald-400",
  warn: "text-amber-600 dark:text-amber-400",
  bad: "text-red-600 dark:text-red-500",
};

/** Title band — GREEN at the 50–60 char sweet spot (full SERP/preview line
 *  without truncation), amber when close, red when far off. */
export function ogTitleBand(len: number): Band {
  if (len === 0) return "empty";
  if (len >= 50 && len <= 60) return "good";
  if (len >= 30 && len <= 70) return "warn";
  return "bad";
}

/** Description band — GREEN at the 110–160 char sweet spot. */
export function ogDescriptionBand(len: number): Band {
  if (len === 0) return "empty";
  if (len >= 110 && len <= 160) return "good";
  if (len >= 70 && len <= 200) return "warn";
  return "bad";
}

function bandHint(kind: "title" | "description", band: Band): string {
  if (kind === "title") {
    switch (band) {
      case "empty": return "Aim for 50–60 characters so the whole title shows without being cut off.";
      case "good": return "Great length — fits in full across link previews and search results.";
      case "warn": return "A little outside the ideal 50–60 characters. Still fine, but tighten if you can.";
      case "bad": return "Too far from the ideal 50–60 characters — this title may be cut off or look thin.";
    }
  }
  switch (band) {
    case "empty": return "Aim for 110–160 characters so the description reads fully without truncation.";
    case "good": return "Great length — reads in full across link previews and search results.";
    case "warn": return "A little outside the ideal 110–160 characters. Still fine, but adjust if you can.";
    case "bad": return "Too far from the ideal 110–160 characters — this may be cut off or look sparse.";
  }
}

/**
 * Live character-count readout with a green / amber / red band and a tooltip
 * explaining the recommendation. Drop it under the title / description input.
 */
export function OgCharCount({
  value,
  kind,
}: {
  value: string;
  kind: "title" | "description";
}) {
  const len = value.length;
  const band = kind === "title" ? ogTitleBand(len) : ogDescriptionBand(len);
  const ideal = kind === "title" ? "50–60" : "110–160";
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <p className={`text-[10px] mt-1 cursor-help inline-flex items-center gap-1 ${BAND_COLOR[band]}`}>
            <span className="font-medium">{len}</span>
            <span className="text-muted-foreground">chars · ideal {ideal}</span>
          </p>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[220px] text-xs leading-relaxed">
          {bandHint(kind, band)}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** Load an image and report its natural pixel dimensions (or an error). */
export function useImageDimensions(url: string | null | undefined): {
  width: number | null;
  height: number | null;
  loading: boolean;
  error: boolean;
} {
  const [state, setState] = useState<{ width: number | null; height: number | null; loading: boolean; error: boolean }>(
    { width: null, height: null, loading: false, error: false },
  );
  useEffect(() => {
    const u = (url ?? "").trim();
    if (!u) {
      setState({ width: null, height: null, loading: false, error: false });
      return;
    }
    let cancelled = false;
    setState({ width: null, height: null, loading: true, error: false });
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      setState({ width: img.naturalWidth, height: img.naturalHeight, loading: false, error: false });
    };
    img.onerror = () => {
      if (cancelled) return;
      setState({ width: null, height: null, loading: false, error: true });
    };
    img.src = u;
    return () => { cancelled = true; };
  }, [url]);
  return state;
}

/** True when the dimensions are NOT the canonical 1200×630 (within a 1px
 *  tolerance for rounding). Null dimensions = unknown = no warning. */
export function isOffSpec(width: number | null, height: number | null): boolean {
  if (width == null || height == null) return false;
  return Math.abs(width - OG_IMAGE_WIDTH) > 1 || Math.abs(height - OG_IMAGE_HEIGHT) > 1;
}

/** Canonicalise a URL to its absolute form so relative (`/api/storage/…`) and
 *  absolute (`https://host/api/storage/…`) shapes of the SAME image compare
 *  equal. Callsites differ on which shape they store, so identity tracking
 *  (already-attempted / resized) must normalise or the undo escape hatch can
 *  re-trigger an auto-resize. */
function normalizeUrl(u: string): string {
  const trimmed = u.trim();
  if (!trimmed) return "";
  try {
    return new URL(trimmed, typeof window !== "undefined" ? window.location.origin : "http://localhost").href;
  } catch {
    return trimmed;
  }
}

/**
 * Auto-resize + revert affordance for a share-card image. The moment an
 * off-spec (not 1200×630) image appears — e.g. right after an upload, a pasted
 * URL, or a picker selection — this fetches its bytes client-side and POSTs
 * them to the server resize endpoint (`/api/lp/og-image/resize`, sharp
 * center-crop), then calls `onResized` with the new served URL so every share
 * image is correct by default. Once resized it shows a small confirmation with
 * a one-click "Use original instead" escape hatch. If the automatic resize
 * can't run (e.g. the source can't be fetched cross-origin) it falls back to
 * the manual "Resize to 1200×630" button. Renders nothing when the image is
 * already on-spec, empty, or its dimensions can't be read.
 */
export function OgDimensionWarning({
  imageUrl,
  onResized,
  apiBase = "/api",
}: {
  imageUrl: string | null | undefined;
  onResized: (url: string) => void;
  apiBase?: string;
}) {
  const { width, height, error } = useImageDimensions(imageUrl);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  // After a successful auto-resize, the (normalised) original URL we resized
  // FROM and the resized result, so we can offer a one-click "use original"
  // escape hatch and recognise the current image as our own resize output.
  const [revert, setRevert] = useState<{ original: string; resized: string } | null>(null);
  // Normalised URLs we've already auto-attempted — never retry automatically
  // (prevents an undo→re-resize loop and avoids hammering the endpoint on
  // repeated failures). Normalised so a relative original and its absolutised
  // equivalent (some callsites canonicalise on revert) count as the same image.
  const attempted = useRef<Set<string>>(new Set());
  // Keep the latest onResized without churning the resize callback identity.
  const onResizedRef = useRef(onResized);
  useEffect(() => { onResizedRef.current = onResized; }, [onResized]);

  const url = (imageUrl ?? "").trim();
  const urlKey = normalizeUrl(url);

  const runResize = useCallback(async (sourceUrl: string) => {
    setBusy(true);
    setFailed(false);
    try {
      const resp = await fetch(sourceUrl, { credentials: "include" });
      if (!resp.ok) throw new Error("fetch failed");
      const blob = await resp.blob();
      const fd = new FormData();
      fd.append("file", blob, "og-source");
      const res = await fetch(`${apiBase}/lp/og-image/resize`, { method: "POST", body: fd });
      if (!res.ok) throw new Error("resize failed");
      const { url: newUrl } = (await res.json()) as { url: string };
      // Track by normalised identity so the undo banner recognises whatever
      // shape the parent commits the new URL in (relative or absolutised).
      setRevert({ original: normalizeUrl(sourceUrl), resized: normalizeUrl(newUrl) });
      onResizedRef.current(newUrl);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }, [apiBase]);

  // Auto-resize off-spec images the moment they appear, unless we've already
  // tried this exact image (which also covers the post-revert original).
  useEffect(() => {
    if (!urlKey || error) return;
    if (!isOffSpec(width, height)) return;
    if (attempted.current.has(urlKey)) return;
    attempted.current.add(urlKey);
    void runResize(url);
  }, [url, urlKey, width, height, error, runResize]);

  if (!url) return null;

  // Confirmation + "use original" escape hatch after an automatic resize.
  if (revert && revert.resized === urlKey) {
    return (
      <div className="mt-1.5 space-y-1">
        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
          <Check className="w-3 h-3 shrink-0" />
          Auto-resized to {OG_IMAGE_WIDTH}×{OG_IMAGE_HEIGHT} for crisp link previews.
        </p>
        <button
          type="button"
          onClick={() => {
            const original = revert.original;
            setRevert(null);
            onResizedRef.current(original);
          }}
          className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded border border-input bg-background hover:bg-muted"
        >
          <Undo2 className="w-3 h-3" />
          Use original instead
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1.5 inline-flex items-center gap-1">
        <AlertTriangle className="w-3 h-3 shrink-0" />
        Couldn&apos;t load this image to check its size.
      </p>
    );
  }
  if (!isOffSpec(width, height)) return null;

  // Mid auto-resize.
  if (busy) {
    return (
      <p className="text-[10px] text-muted-foreground mt-1.5 inline-flex items-center gap-1">
        <Loader2 className="w-3 h-3 animate-spin shrink-0" />
        Resizing to {OG_IMAGE_WIDTH}×{OG_IMAGE_HEIGHT}…
      </p>
    );
  }

  // Off-spec but not auto-resized (user reverted to the original, or the
  // automatic attempt failed) — offer a manual resize as a fallback.
  return (
    <div className="mt-1.5 space-y-1">
      <p className="text-[10px] text-amber-600 dark:text-amber-400 inline-flex items-center gap-1">
        <AlertTriangle className="w-3 h-3 shrink-0" />
        This image is {width}×{height}. Share cards look best at {OG_IMAGE_WIDTH}×{OG_IMAGE_HEIGHT}.
      </p>
      <button
        type="button"
        onClick={() => runResize(url)}
        disabled={busy}
        className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded border border-input bg-background hover:bg-muted disabled:opacity-60"
      >
        <Crop className="w-3 h-3" />
        {`Resize to ${OG_IMAGE_WIDTH}×${OG_IMAGE_HEIGHT}`}
      </button>
      {failed && (
        <p className="text-[10px] text-red-600 dark:text-red-500">Couldn&apos;t resize this image. Try a different file.</p>
      )}
    </div>
  );
}

/**
 * ~240px live "share card" preview mirroring how the link will render when
 * pasted into Slack / iMessage / LinkedIn: the OG image (cropped to the 1200×630
 * aspect) above a footer band with the host, title, and description. Falls back
 * to a neutral placeholder when no image is set.
 */
export function ShareCardPreview({
  title,
  description,
  imageUrl,
  domain,
  className = "",
}: {
  title: string;
  description: string;
  imageUrl: string | null | undefined;
  domain?: string | null;
  className?: string;
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgBroken, setImgBroken] = useState(false);
  const url = (imageUrl ?? "").trim();
  useEffect(() => { setImgBroken(false); }, [url]);
  const host = (domain ?? "").trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "");

  return (
    <div
      className={`w-[240px] rounded-lg overflow-hidden border border-border bg-card shadow-sm ${className}`}
    >
      <div className="bg-muted relative" style={{ aspectRatio: String(OG_ASPECT) }}>
        {url && !imgBroken ? (
          <img
            ref={imgRef}
            src={url}
            alt="Share card preview"
            className="absolute inset-0 w-full h-full object-cover"
            onError={() => setImgBroken(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            <ImageIcon className="w-6 h-6" />
          </div>
        )}
      </div>
      <div className="px-3 py-2 bg-muted/40 border-t border-border">
        {host && (
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">{host}</p>
        )}
        <p className="text-[12px] font-semibold text-foreground leading-snug line-clamp-2">
          {title.trim() || "Your page title"}
        </p>
        {(description.trim() || true) && (
          <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2 mt-0.5">
            {description.trim() || "Your page description will appear here."}
          </p>
        )}
      </div>
    </div>
  );
}
