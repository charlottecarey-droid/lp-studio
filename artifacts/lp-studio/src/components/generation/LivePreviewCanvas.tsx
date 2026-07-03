/**
 * LivePreviewCanvas — the scaled-down, auto-following live page preview shown
 * while a generation streams (June 2026). Extracted from GenerationLiveView so
 * the sales microsite generator renders an identical canvas.
 *
 * Owns its own scaling (ResizeObserver), scroll-follow + "Jump to latest"
 * pill, and shimmer skeleton. Stream/save orchestration stays with the caller;
 * hover + manual-scroll are surfaced via callbacks so a caller running an
 * auto-open countdown can pause it.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { ArrowDown } from "lucide-react";
import {
  getBrandButtonCss,
  getBrandSurfaceCss,
  getBrandStyleVars,
  type BrandConfig,
} from "@/lib/brand-config";
import { BrandFontLoader } from "@/components/BrandFontLoader";
import { LiveBlock, PAGE_DESIGN_WIDTH, type LiveEntry } from "./liveBlocks";

export interface LivePreviewCanvasProps {
  entries: LiveEntry[];
  brand: BrandConfig;
  /** True while the stream is in flight — drives the shimmer + auto-follow. */
  streaming: boolean;
  reduced: boolean;
  /** Browser-chrome label (typically the tenant/brand name). */
  title: string;
  /** Repeat-guard restart notice (marketing only). */
  restartMsg?: string | null;
  /** Hover enter/leave on the canvas — lets the caller pause a countdown. */
  onHoverChange?: (hovering: boolean) => void;
  /** Fires on a genuine user scroll (not our own auto-scroll). */
  onUserScroll?: () => void;
  /** Bump this whenever a new generation starts (e.g. retry/shuffle `attempt`)
   *  to re-enable auto-follow even if the user had scrolled up in the prior
   *  run. */
  resetFollowKey?: number;
  /** Extra absolutely-positioned overlays (fallback spinner, error card, …). */
  overlay?: ReactNode;
}

export function LivePreviewCanvas({
  entries,
  brand,
  streaming,
  reduced,
  title,
  restartMsg,
  onHoverChange,
  onUserScroll,
  resetFollowKey,
  overlay,
}: LivePreviewCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.65);
  const [innerH, setInnerH] = useState(0);
  const [following, setFollowing] = useState(true);
  const followRef = useRef(true);
  const suppressScrollUntilRef = useRef(0);

  const brandButtonCss = getBrandButtonCss(brand);
  const brandSurfaceCss = getBrandSurfaceCss(brand);

  // Re-enable auto-follow whenever a new generation starts, even if the user
  // had scrolled up in the previous run (parity with the pre-extraction view,
  // which reset follow state at each stream start).
  useEffect(() => {
    followRef.current = true;
    setFollowing(true);
  }, [resetFollowKey]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth - 48; // canvas padding
      if (w > 0) setScale(Math.min(0.7, Math.max(0.35, w / PAGE_DESIGN_WIDTH)));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setInnerH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const jumpToLatest = useCallback(
    (behavior?: ScrollBehavior) => {
      const el = canvasRef.current;
      if (!el) return;
      suppressScrollUntilRef.current = Date.now() + 800;
      followRef.current = true;
      setFollowing(true);
      el.scrollTo({ top: el.scrollHeight, behavior: behavior ?? (reduced ? "auto" : "smooth") });
    },
    [reduced],
  );

  // Auto-follow the newest content while streaming, unless the user scrolled
  // away ("Jump to latest" pill resumes).
  useEffect(() => {
    if (!streaming) return;
    if (!followRef.current) return;
    jumpToLatest();
  }, [entries.length, innerH, streaming, jumpToLatest]);

  const handleCanvasScroll = useCallback(() => {
    if (Date.now() < suppressScrollUntilRef.current) return; // our own auto-scroll
    onUserScroll?.();
    const el = canvasRef.current;
    if (!el) return;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 120;
    followRef.current = atBottom;
    setFollowing(atBottom);
  }, [onUserScroll]);

  return (
    <div
      className="relative flex-1 min-h-0 bg-muted/50"
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
    >
      <div
        ref={canvasRef}
        onScroll={handleCanvasScroll}
        className="absolute inset-0 overflow-y-auto overflow-x-hidden p-6"
        aria-busy={streaming}
        aria-label="Live page preview"
      >
        <div className="mx-auto" style={{ width: PAGE_DESIGN_WIDTH * scale }}>
          {/* Browser-chrome top bar */}
          <div className="flex items-center gap-2 rounded-t-lg border border-b-0 border-border bg-card px-3 py-2">
            <span className="flex gap-1.5" aria-hidden>
              <span className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-green-400/70" />
            </span>
            <span className="flex-1 text-center text-[11px] text-muted-foreground truncate">
              {title}
            </span>
          </div>

          {/* Scaled page surface. Spacer height = content height × scale so
              the scroll container's height matches what's visible. */}
          <div
            className="relative overflow-hidden rounded-b-lg border border-border bg-white shadow-sm"
            style={{ height: innerH > 0 ? innerH * scale : undefined, minHeight: 240 }}
          >
            <div
              style={{
                width: PAGE_DESIGN_WIDTH,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
              }}
            >
              {/* Page-level brand wrapper — same conventions as the
                  landing-page viewer: [data-lp-page] + brand CSS vars +
                  BrandFontLoader + brand button CSS. */}
              <div
                ref={innerRef}
                data-lp-page
                className="w-full bg-white font-sans"
                style={getBrandStyleVars(brand)}
              >
                <BrandFontLoader brand={brand} />
                {brandButtonCss && <style>{brandButtonCss}</style>}
                {brandSurfaceCss && <style>{brandSurfaceCss}</style>}
                {entries.map((entry) => (
                  <LiveBlock
                    key={entry.key}
                    block={entry.block}
                    hash={entry.hash}
                    brand={brand}
                    reduced={reduced}
                  />
                ))}

                {/* Shimmer skeleton: the "next section is being written"
                    placeholder while streaming (and the whole-page skeleton
                    on paths that emit no per-block events). */}
                {streaming && (
                  <div className="px-16 py-14 space-y-6" aria-hidden>
                    {entries.length === 0 && (
                      <div className="space-y-6 pb-10">
                        <div className="h-64 rounded-2xl bg-slate-100 animate-pulse motion-reduce:animate-none" />
                        <div className="grid grid-cols-3 gap-6">
                          <div className="h-32 rounded-xl bg-slate-100 animate-pulse motion-reduce:animate-none" />
                          <div className="h-32 rounded-xl bg-slate-100 animate-pulse motion-reduce:animate-none" />
                          <div className="h-32 rounded-xl bg-slate-100 animate-pulse motion-reduce:animate-none" />
                        </div>
                      </div>
                    )}
                    <div className="h-7 w-1/3 rounded-md bg-slate-100 animate-pulse motion-reduce:animate-none" />
                    <div className="space-y-3">
                      <div className="h-4 w-5/6 rounded bg-slate-100 animate-pulse motion-reduce:animate-none" />
                      <div className="h-4 w-2/3 rounded bg-slate-100 animate-pulse motion-reduce:animate-none" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Jump-to-latest pill (auto-follow paused by a manual scroll-up) */}
      {!following && streaming && entries.length > 0 && (
        <button
          type="button"
          onClick={() => jumpToLatest()}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 inline-flex items-center gap-1.5 rounded-full bg-foreground text-background text-xs font-medium px-3.5 py-1.5 shadow-lg hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <ArrowDown className="w-3.5 h-3.5" aria-hidden />
          Jump to latest
        </button>
      )}

      {/* Repeat-guard restart notice */}
      {restartMsg && (
        <div
          className="absolute inset-x-0 top-6 z-20 flex justify-center px-6"
          role="status"
          aria-live="polite"
        >
          <motion.div
            initial={reduced ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="rounded-lg border border-border bg-card px-4 py-2.5 text-xs text-foreground shadow-md max-w-md text-center"
          >
            {restartMsg}
          </motion.div>
        </div>
      )}

      {overlay}
    </div>
  );
}
