/**
 * Content Hub — in-page asset viewer.
 *
 * One modal for every asset kind: a PDF renders in an <iframe> (the browser's
 * own viewer, same-origin storage URLs included), a native video in <video
 * controls>, an embed link (YouTube / Vimeo / Wistia / Loom) in its player
 * iframe. The header carries the kind chip, the title and the actions —
 * Download (when the file is ours), Open in new tab, Close.
 *
 * Phones hand PDFs to the browser instead (iOS renders only the first page
 * inside an iframe): `shouldOpenInline` says so, and the card then opens the
 * file in a new tab rather than the modal.
 */
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Download, ExternalLink, X } from "lucide-react";
import { getAutoplayEmbedUrl } from "@/lib/video-utils";
import { HUB_BODY, HUB_PILL_SM_CLASS, hubPillStyle, type HubPalette } from "@/lib/hub-theme";
import { ASSET_KIND_LABEL, isNativeVideoFile, resolveAssetHref, resolveDownloadHref, type HubAsset } from "./hub-assets";

export interface HubAssetViewerProps {
  asset: HubAsset | null;
  onClose: () => void;
  palette: HubPalette;
  onDownload?: (a: HubAsset) => void;
  onOpenExternal?: (a: HubAsset) => void;
  /** Fired once per 25/50/75/100% milestone of a native video. */
  onProgress?: (a: HubAsset, pct: number) => void;
  /** Fired when the viewer closes, with the seconds it stayed open. */
  onTimeOpen?: (a: HubAsset, seconds: number) => void;
}

/** True when this asset should open inside the modal on this device. */
export function shouldOpenInline(a: HubAsset): boolean {
  if (typeof window === "undefined") return false;
  if (a.kind === "pdf") {
    // Narrow / touch devices get the browser's full-screen PDF handling.
    const narrow = window.matchMedia?.("(max-width: 767px)")?.matches ?? false;
    const touch = window.matchMedia?.("(hover: none) and (pointer: coarse)")?.matches ?? false;
    return !(narrow || touch);
  }
  return true;
}

export function HubAssetViewer({ asset, onClose, palette, onDownload, onOpenExternal, onProgress, onTimeOpen }: HubAssetViewerProps) {
  const reduced = useReducedMotion() ?? false;
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const lastFocused = useRef<HTMLElement | null>(null);
  const open = !!asset;

  // Time open: measured from mount to close (or the page unloading), reported
  // once. The asset is captured so a close that swaps the asset still reports
  // the one that was open.
  const openedAtRef = useRef<number>(0);
  const milestonesRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    if (!asset) return;
    const a = asset;
    openedAtRef.current = Date.now();
    milestonesRef.current = new Set();
    const report = () => {
      if (!openedAtRef.current) return;
      const seconds = Math.round((Date.now() - openedAtRef.current) / 1000);
      openedAtRef.current = 0;
      if (seconds >= 1) onTimeOpen?.(a, seconds);
    };
    window.addEventListener("pagehide", report);
    return () => {
      window.removeEventListener("pagehide", report);
      report();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset]);
  const onVideoTime = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const v = e.currentTarget;
    if (!asset || !v.duration || !Number.isFinite(v.duration)) return;
    const pct = (v.currentTime / v.duration) * 100;
    for (const m of [25, 50, 75, 100]) {
      if (pct >= m - (m === 100 ? 1 : 0) && !milestonesRef.current.has(m)) {
        milestonesRef.current.add(m);
        onProgress?.(asset, m);
      }
    }
  };

  useEffect(() => {
    if (!open) return;
    lastFocused.current = (document.activeElement as HTMLElement) || null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const raf = requestAnimationFrame(() => closeRef.current?.focus());
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      cancelAnimationFrame(raf);
      lastFocused.current?.focus?.();
    };
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  const dark = palette.dark;
  const href = asset ? resolveAssetHref(asset) : "";
  const download = asset ? resolveDownloadHref(asset) : null;

  let body: React.ReactNode = null;
  if (asset && href) {
    if (asset.kind === "video") {
      body = isNativeVideoFile(asset, href) ? (
        <video src={href} controls autoPlay playsInline poster={asset.thumbnailUrl || undefined} className="h-full w-full bg-black" onTimeUpdate={onVideoTime} onEnded={onVideoTime} />
      ) : (
        <iframe src={getAutoplayEmbedUrl(href)} title={asset.title} className="h-full w-full bg-black" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowFullScreen />
      );
    } else {
      const src = `${href}${href.includes("#") ? "&" : "#"}toolbar=0&navpanes=0&view=FitH`;
      body = <iframe src={src} title={asset.title} className="h-full w-full bg-white" />;
    }
  }

  return createPortal(
    <AnimatePresence>
      {open && asset && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={asset.title}
          className="fixed inset-0 z-[1000] flex items-stretch justify-center p-0 sm:p-6 lg:p-10"
          style={{ background: "rgba(5,8,10,0.78)", backdropFilter: "blur(10px)", fontFamily: HUB_BODY }}
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduced ? undefined : { opacity: 0 }}
          transition={{ duration: 0.2 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            className="relative flex w-full max-w-[1280px] flex-col overflow-hidden sm:rounded-[22px]"
            style={{ background: dark.bg, color: dark.text, boxShadow: "0 60px 120px -40px rgba(0,0,0,0.8)", border: `1px solid ${dark.hairline}` }}
            initial={reduced ? false : { opacity: 0, y: 18, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? undefined : { opacity: 0, y: 12, scale: 0.99 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 sm:px-5" style={{ borderBottom: `1px solid ${dark.hairline}` }}>
              <span className="inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ background: `color-mix(in srgb, ${dark.accent} 18%, transparent)`, color: dark.accent }}>
                {ASSET_KIND_LABEL[asset.kind]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold leading-tight">{asset.title}</p>
                {asset.meta && <p className="truncate text-[12px]" style={{ color: dark.faint }}>{asset.meta}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {download && (
                  <a
                    href={download}
                    download=""
                    onClick={() => onDownload?.(asset)}
                    className={`${HUB_PILL_SM_CLASS} hidden sm:inline-flex`}
                    style={{ ...hubPillStyle(palette, "solid", "sm"), background: dark.accent, color: palette.onAccentFill, boxShadow: "none" }}
                  >
                    <Download className="h-4 w-4" aria-hidden />
                    Download
                  </a>
                )}
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => onOpenExternal?.(asset)}
                  className={`${HUB_PILL_SM_CLASS} hidden sm:inline-flex`}
                  style={{ ...hubPillStyle(palette, "ghost", "sm"), background: "transparent", color: dark.text, border: `1px solid ${dark.hairline}` }}
                  aria-label="Open in a new tab"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden />
                  <span className="hidden md:inline">New tab</span>
                </a>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors"
                  style={{ background: dark.panelRaised, color: dark.text }}
                >
                  <X className="h-5 w-5" aria-hidden />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="relative flex-1 bg-black" style={{ minHeight: asset.kind === "video" ? "min(62vw, 72vh)" : "min(88vh, 1200px)", maxHeight: "calc(100vh - 56px)" }}>
              {body ?? (
                <div className="flex h-full items-center justify-center p-10 text-center text-sm" style={{ color: dark.muted }}>
                  This item has no file attached yet.
                </div>
              )}
            </div>

            {/* Mobile actions */}
            {(download || href) && (
              <div className="flex items-center gap-2 px-4 py-3 sm:hidden" style={{ borderTop: `1px solid ${dark.hairline}` }}>
                {download && (
                  <a href={download} download="" onClick={() => onDownload?.(asset)} className={`${HUB_PILL_SM_CLASS} flex-1`} style={{ ...hubPillStyle(palette, "solid", "sm"), background: dark.accent, color: palette.onAccentFill, boxShadow: "none" }}>
                    <Download className="h-4 w-4" aria-hidden /> Download
                  </a>
                )}
                <a href={href} target="_blank" rel="noopener noreferrer" onClick={() => onOpenExternal?.(asset)} className={`${HUB_PILL_SM_CLASS} flex-1`} style={{ ...hubPillStyle(palette, "ghost", "sm"), background: "transparent", color: dark.text, border: `1px solid ${dark.hairline}` }}>
                  <ExternalLink className="h-4 w-4" aria-hidden /> New tab
                </a>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
