import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Maximize, Pause, Play, Volume2, VolumeX, X } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { isValidHex } from "@/lib/brand-config";
import { useStaticRender } from "@/lib/reveal-fallback";
import { extractWistiaId, wistiaIframeUrl } from "@/lib/wistia";
import { getAutoplayEmbedUrl, isNativeVideoUrl } from "@/lib/video-utils";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import {
  MINT_BODY, MINT_CSS, MINT_DISPLAY, MINT_RING, MINT_SECTION_PAD, MINT_SHADOW_2, MINT_WIDE,
  MintEyebrow, MintLink, MintNumber, MintSectionHeader, mintAnchorClick, mintDisplay, mintHighlight, resolveMintPalette, useMintReveal,
  type MintStyleProps,
} from "./mint/mint-theme";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Mint Story — type "mint-story"  (DSO Page (Light) family, Nov 2026)
 *
 * The v2 video customer story on white: the section header row (eyebrow
 * "Customer story · Org", a 20ch h2, the story link at the right), then a
 * 7/5 grid. Left, a 16:9 ringed player painted in the deep brand green: the
 * poster photo (saturate .8, a slow scale on hover), the v2 shade (.1 top,
 * .7 bottom), a "Film · 3:40" tag pill top-left, a caption row (title + sub),
 * a 76px lime play disc with an inset white highlight and the artifact's own
 * control bar (play/pause, time, a clickable track with a lime fill,
 * duration, mute, full screen). Right, the quote in the display face with
 * drawn quote marks and a lime highlight under one phrase, the cite row with
 * a 36px mint avatar disc (the org's initial), and up to three numbers as
 * grey ringed tiles in a 3-col grid.
 *
 * Video: a native mp4/webm/storage URL is driven by the custom bar through
 * a <video preload="none">; Wistia/YouTube/Vimeo/Loom links swap an iframe
 * in on play and hide the bar. With no video at all, the big play opens
 * `fallbackUrl` (the story link) in a new tab, like the artifact.
 * -------------------------------------------------------------------------- */

export interface MintStoryStat {
  value: string;
  label: string;
}

export interface MintStoryBlockProps extends MintStyleProps {
  /** Section eyebrow ("Customer story") and its muted suffix ("· Northwind Health"). */
  eyebrow?: string;
  eyebrowSuffix?: string;
  /** Display headline in the header row. */
  headline: string;
  /** The pull quote (no quote marks — they are drawn). */
  quote: string;
  /** A phrase inside the quote that gets the lime highlight; blank = none. */
  highlight?: string;
  citeRole?: string;
  citeOrg?: string;
  /** The letter in the avatar disc; blank = the first letter of `citeOrg`. */
  citeInitial?: string;
  posterUrl?: string;
  posterAlt?: string;
  posterFocal?: string;
  /** Caption row on the poster: bold title + sub. */
  posterTitle?: string;
  posterSub?: string;
  /** The tag pill top-left reads "<tag> · <duration>" (either alone when the other is blank). */
  tag?: string;
  duration?: string;
  /** Wistia, YouTube, Vimeo, Loom or a native mp4/webm/storage URL. */
  videoUrl?: string;
  /** Opened in a new tab by the play button when there is no video (the story link). */
  fallbackUrl?: string;
  mediaSide?: "left" | "right";
  /** Up to three outcome numbers under the cite. */
  stats?: MintStoryStat[];
  /** The quiet chevron link at the right of the header row. */
  linkText?: string;
  linkUrl?: string;
  anchorId?: string;
}

interface Props {
  props: MintStoryBlockProps;
  brand: BrandConfig;
  pageId?: number;
  variantId?: number;
  onCtaClick?: () => void;
  onFieldChange?: (updated: MintStoryBlockProps) => void;
}

export const MINT_STORY_MAX_STATS = 3;

export const MINT_STORY_DEFAULT_PROPS: MintStoryBlockProps = {
  eyebrow: "Customer story",
  eyebrowSuffix: "· Northwind Health",
  headline: "Dentures rebuilt around two appointments.",
  quote: "We stopped asking doctors to change labs. We gave them a lab they would have chosen anyway, and the schedule took care of itself.",
  highlight: "took care of itself.",
  citeRole: "Chief Clinical Officer",
  citeOrg: "Northwind Health",
  citeInitial: "",
  posterUrl: "",
  posterAlt: "",
  posterTitle: "The Northwind Health story",
  posterSub: "A mobile dental group, 6,000 denture cases a year",
  tag: "Film",
  duration: "3:40",
  videoUrl: "",
  fallbackUrl: "",
  mediaSide: "left",
  stats: [
    { value: "40%", label: "faster denture turnaround" },
    { value: "2", label: "appointments per denture" },
    { value: "10K+", label: "appointments recaptured" },
  ],
  linkText: "Read the Northwind story",
  linkUrl: "#",
  anchorId: "story",
  backgroundStyle: "white",
};

function isNativeStoryVideo(url: string): boolean {
  return isNativeVideoUrl(url) || /\.(m4v)(\?|#|$)/i.test(url) || url.startsWith("/api/storage/");
}

function fmt(s: number): string {
  const whole = Math.max(0, Math.floor(Number.isFinite(s) ? s : 0));
  return `${Math.floor(whole / 60)}:${`0${whole % 60}`.slice(-2)}`;
}

/** The quote with the highlighted phrase wrapped (live page only; the builder edits the plain string). */
function Quote({ text, highlight, lime }: { text: string; highlight?: string; lime: string }) {
  const hl = (highlight ?? "").trim();
  const idx = hl ? text.indexOf(hl) : -1;
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span style={mintHighlight(lime)}>{hl}</span>
      {text.slice(idx + hl.length)}
    </>
  );
}

export function BlockMintStory({ props, brand, onFieldChange }: Props) {
  const p = { ...MINT_STORY_DEFAULT_PROPS, ...props };
  const pal = resolveMintPalette(p, brand, "#FFFFFF");
  const isEditor = !!onFieldChange;
  const reduced = useReducedMotion() ?? false;
  const staticRender = useStaticRender();
  const { ref, rise } = useMintReveal<HTMLElement>();

  const field = (key: keyof MintStoryBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as MintStoryBlockProps[typeof key] }) : undefined;
  const stats = (p.stats ?? []).filter((s) => s.value?.trim() || isEditor).slice(0, MINT_STORY_MAX_STATS);
  const updateStat = onFieldChange
    ? (i: number, patch: Partial<MintStoryStat>) => onFieldChange({ ...props, stats: (p.stats ?? []).map((s, idx) => (idx === i ? { ...s, ...patch } : s)) })
    : undefined;

  const heading = p.headingColor && isValidHex(p.headingColor) ? pal.heading : pal.ink;
  const ink = pal.ink;
  const muted = pal.inkMuted;
  const linkInk = pal.dark ? pal.lime : pal.green;
  const title = p.posterTitle || p.citeOrg || "Customer story";
  const mediaRight = p.mediaSide === "right";

  // ---- video source handling (ported from the forest story) ----
  const videoUrl = (p.videoUrl ?? "").trim();
  const wistiaId = videoUrl ? extractWistiaId(videoUrl) : null;
  const native = !!videoUrl && !wistiaId && isNativeStoryVideo(videoUrl);
  const embedUrl = videoUrl && !wistiaId && !native ? getAutoplayEmbedUrl(videoUrl) : "";
  const canPlay = !!videoUrl && (!!wistiaId || native || embedUrl !== videoUrl);
  const iframeSrc = wistiaId ? wistiaIframeUrl(wistiaId, { autoPlay: true }) : embedUrl;
  const fallback = (p.fallbackUrl ?? "").trim() || ((p.linkUrl ?? "").trim().startsWith("#") ? "" : (p.linkUrl ?? "").trim());

  // ---- native player state (the artifact's custom control bar) ----
  const playerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(true);
  const [current, setCurrent] = useState(0);
  const [length, setLength] = useState(0);
  const [isMuted, setMuted] = useState(false);
  const [embedPlaying, setEmbedPlaying] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onPlay = () => { setStarted(true); setPaused(false); };
    const onPause = () => setPaused(true);
    const onEnded = () => { setStarted(false); setPaused(true); };
    const onMeta = () => setLength(v.duration || 0);
    const onTime = () => { setCurrent(v.currentTime || 0); if (v.duration) setLength(v.duration); };
    const onVolume = () => setMuted(v.muted);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("ended", onEnded);
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("volumechange", onVolume);
    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("ended", onEnded);
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("volumechange", onVolume);
    };
  }, [native, videoUrl]);

  const toggle = useCallback(() => {
    if (native) {
      const v = videoRef.current;
      if (!v) return;
      if (v.paused) v.play().catch(() => {});
      else v.pause();
      return;
    }
    if (canPlay) {
      setEmbedPlaying(true);
      return;
    }
    if (!isEditor && fallback && typeof window !== "undefined") window.open(fallback, "_blank", "noopener");
  }, [native, canPlay, isEditor, fallback]);

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    const t = trackRef.current;
    if (!v || !t || !v.duration) return;
    const r = t.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    v.currentTime = ratio * v.duration;
  };
  const seekKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    if (e.key === "ArrowRight") { e.preventDefault(); v.currentTime = Math.min(v.duration, v.currentTime + 5); }
    if (e.key === "ArrowLeft") { e.preventDefault(); v.currentTime = Math.max(0, v.currentTime - 5); }
  };
  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };
  const fullscreen = () => {
    const el = playerRef.current as (HTMLDivElement & { webkitRequestFullscreen?: () => Promise<void> }) | null;
    if (!el) return;
    const req = el.requestFullscreen ? el.requestFullscreen.bind(el) : el.webkitRequestFullscreen ? el.webkitRequestFullscreen.bind(el) : null;
    if (!req) return;
    try {
      const r = req();
      if (r && typeof (r as Promise<void>).catch === "function") (r as Promise<void>).catch(() => {});
    } catch {
      /* fullscreen refused — nothing to do */
    }
  };

  const playing = native ? started : embedPlaying;
  const showBar = !embedPlaying;
  const pct = length ? Math.max(0, Math.min(100, (current / length) * 100)) : 0;
  const cream = pal.cream;
  const creamMuted = pal.creamMuted;
  const fade = (visible: boolean): React.CSSProperties => ({
    opacity: visible ? 1 : 0,
    pointerEvents: visible ? undefined : "none",
    transition: reduced || staticRender ? "none" : "opacity .5s",
  });
  const bigPlayLabel = canPlay ? (playing && !paused ? "Pause" : `Play the ${title} story`) : fallback && !isEditor ? "Open the story" : "Add a video in the panel to play";

  const posterLayer = (
    <>
      {(p.posterUrl || isEditor) ? (
        <InlineImage
          src={p.posterUrl ?? ""}
          alt={p.posterAlt || title}
          className="mint-poster-img h-full w-full object-cover"
          wrapperClassName="absolute inset-0"
          style={{ filter: "saturate(.8)", transition: reduced ? "none" : "transform 1.6s cubic-bezier(.16,1,.3,1)", ...fade(!playing) }}
          focalPoint={p.posterFocal}
          onUpdate={field("posterUrl")}
          onAltUpdate={field("posterAlt")}
          onFocalUpdate={field("posterFocal")}
        />
      ) : (
        <div aria-hidden className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 30% 20%, color-mix(in srgb, ${pal.lime} 16%, transparent), transparent 55%), linear-gradient(160deg, ${pal.green} 0%, ${pal.deep} 100%)`, ...fade(!playing) }} />
      )}
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: `linear-gradient(180deg, color-mix(in srgb, ${pal.deep} 10%, transparent), transparent 35%, color-mix(in srgb, ${pal.deep} 70%, transparent))`, ...fade(!playing), pointerEvents: "none" }} />
      {/* Tag pill ("Film · 3:40") */}
      {(p.tag || p.duration || isEditor) && (
        <span className="absolute left-[18px] top-[18px] z-[2] inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: cream, background: `color-mix(in srgb, ${pal.deep} 50%, transparent)`, backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", border: "1px solid rgba(255,252,239,0.14)", ...fade(!playing), pointerEvents: isEditor ? undefined : "none" }}>
          {(p.tag || isEditor) && <InlineText as="span" value={p.tag ?? ""} onUpdate={field("tag")} />}
          {(p.tag || isEditor) && (p.duration || isEditor) && <span aria-hidden>·</span>}
          {(p.duration || isEditor) && <span className="tabular-nums"><InlineText as="span" value={p.duration ?? ""} onUpdate={field("duration")} /></span>}
        </span>
      )}
      {/* Caption row */}
      <div className="absolute bottom-[58px] left-[22px] right-[22px] z-[2] flex items-end justify-between gap-3.5 text-[13px]" style={{ color: cream, ...fade(!playing), pointerEvents: isEditor ? undefined : "none" }}>
        <div className="min-w-0">
          {(p.posterTitle || isEditor) && (
            <b className="block" style={{ fontFamily: MINT_DISPLAY, fontSize: "1.2rem", letterSpacing: "-0.02em", fontWeight: 400, lineHeight: 1.2 }}>
              <InlineText as="span" value={p.posterTitle ?? ""} onUpdate={field("posterTitle")} />
            </b>
          )}
          {(p.posterSub || isEditor) && (
            <span className="block" style={{ color: creamMuted }}>
              <InlineText as="span" value={p.posterSub ?? ""} onUpdate={field("posterSub")} />
            </span>
          )}
        </div>
      </div>
      {/* Big play disc */}
      <button
        type="button"
        onClick={toggle}
        aria-label={bigPlayLabel}
        className="mint-big absolute left-1/2 top-1/2 z-[3] grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-0 p-0 sm:h-[76px] sm:w-[76px]"
        style={{ background: pal.lime, color: pal.onLime, boxShadow: "0 10px 30px rgba(0,0,0,.25), inset 0 1px 0 rgba(255,255,255,.5)", cursor: canPlay || (fallback && !isEditor) ? "pointer" : "default", ...fade(!playing), transition: reduced ? "none" : "transform .5s cubic-bezier(.16,1,.3,1), opacity .4s" }}
      >
        <Play className="ml-[3px] h-5 w-5 sm:h-6 sm:w-6" fill="currentColor" strokeWidth={0} aria-hidden />
      </button>
    </>
  );

  const controlBar = (
    <div
      className="mint-ctrl absolute bottom-0 left-0 right-0 z-[4] flex items-center gap-3 px-4 pb-3.5 pt-3 text-[12px] tabular-nums"
      style={{ color: cream, background: `linear-gradient(180deg, transparent, color-mix(in srgb, ${pal.deep} 60%, transparent))` }}
    >
      <button type="button" onClick={toggle} aria-label={native && !paused ? "Pause" : "Play"} className="grid h-7 w-7 place-items-center rounded-full border-0 bg-transparent p-0" style={{ color: "inherit" }}>
        {native && !paused ? <Pause className="h-4 w-4" fill="currentColor" strokeWidth={0} aria-hidden /> : <Play className="h-4 w-4" fill="currentColor" strokeWidth={0} aria-hidden />}
      </button>
      <span>{fmt(current)}</span>
      <div
        ref={trackRef}
        role="slider"
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={Math.round(length) || 0}
        aria-valuenow={Math.round(current)}
        tabIndex={native ? 0 : -1}
        onClick={seek}
        onKeyDown={seekKey}
        className="relative h-1 flex-1 cursor-pointer rounded-[2px]"
        style={{ background: "rgba(255,252,239,0.3)" }}
      >
        <i className="absolute bottom-0 left-0 top-0 block rounded-[2px]" style={{ width: `${pct}%`, background: pal.lime }} />
        <span aria-hidden className="absolute -inset-y-2 inset-x-0" />
      </div>
      <span>{length ? fmt(length) : (p.duration || "0:00")}</span>
      <button type="button" onClick={toggleMute} aria-label={isMuted ? "Unmute" : "Mute"} aria-pressed={isMuted} className="grid h-7 w-7 place-items-center rounded-full border-0 bg-transparent p-0" style={{ color: "inherit", opacity: isMuted ? 0.5 : 1 }}>
        {isMuted ? <VolumeX className="h-4 w-4" aria-hidden /> : <Volume2 className="h-4 w-4" aria-hidden />}
      </button>
      <button type="button" onClick={fullscreen} aria-label="Full screen" className="grid h-7 w-7 place-items-center rounded-full border-0 bg-transparent p-0" style={{ color: "inherit" }}>
        <Maximize className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );

  const player = (
    <motion.div {...rise(0)} className={cn(mediaRight && "min-[900px]:order-2")}>
      <div
        ref={playerRef}
        className={cn("mint-player group relative w-full overflow-hidden rounded-[20px]", playing && "playing")}
        style={{ aspectRatio: "16 / 9", background: pal.deep, boxShadow: `${MINT_RING}, ${MINT_SHADOW_2}` }}
      >
        {native && (
          <video
            ref={videoRef}
            src={videoUrl}
            preload="none"
            playsInline
            poster={p.posterUrl || undefined}
            aria-label={`The ${title} story`}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        {embedPlaying ? (
          <>
            <iframe src={iframeSrc} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen title={`${title} story`} className="absolute inset-0 h-full w-full border-0" />
            {isEditor && (
              <button type="button" onClick={() => setEmbedPlaying(false)} aria-label="Back to the poster" className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border-0" style={{ background: "rgba(0,0,0,0.55)", color: "#fff" }}>
                <X className="h-4 w-4" />
              </button>
            )}
          </>
        ) : (
          <>
            {/* Live page: the poster itself toggles playback, like the artifact (the disc is the keyboard path). */}
            {!isEditor && <div aria-hidden className="absolute inset-0 z-[1] cursor-pointer" onClick={toggle} />}
            {posterLayer}
            {showBar && controlBar}
          </>
        )}
      </div>
    </motion.div>
  );

  const initial = (p.citeInitial ?? "").trim() || (p.citeOrg ?? "").trim().charAt(0).toUpperCase();
  const tileBg = pal.dark ? pal.card : pal.grey;
  const copy = (
    <motion.div {...rise(0.1)} className={cn("text-left", mediaRight && "min-[900px]:order-1")}>
      <p style={{ fontFamily: MINT_DISPLAY, fontSize: "clamp(1.35rem, 2.1vw, 1.85rem)", lineHeight: 1.22, letterSpacing: "-0.025em", color: heading, fontWeight: 400, margin: 0, textWrap: "pretty" } as React.CSSProperties}>
        <span aria-hidden>“</span>
        {isEditor ? (
          <InlineText as="span" value={p.quote} onUpdate={field("quote")} multiline />
        ) : (
          <Quote text={p.quote} highlight={p.highlight} lime={pal.lime} />
        )}
        <span aria-hidden>”</span>
      </p>
      {(p.citeRole || p.citeOrg || isEditor) && (
        <div className="mt-[18px] flex items-center gap-3 text-[14px]" style={{ color: muted }}>
          {(initial || isEditor) && (
            <span aria-hidden={!isEditor} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[14px]" style={{ background: pal.mint, color: pal.green, fontFamily: MINT_DISPLAY }}>
              {isEditor ? <InlineText as="span" value={p.citeInitial || initial} onUpdate={field("citeInitial")} /> : initial}
            </span>
          )}
          <span className="min-w-0 leading-[1.35]">
            {(p.citeRole || isEditor) && (
              <b className="block font-medium" style={{ color: ink }}>
                <InlineText as="span" value={p.citeRole ?? ""} onUpdate={field("citeRole")} />
              </b>
            )}
            {(p.citeOrg || isEditor) && <InlineText as="span" value={p.citeOrg ?? ""} onUpdate={field("citeOrg")} />}
          </span>
        </div>
      )}
      {stats.length > 0 && (
        <div className="mt-[26px] grid grid-cols-3 gap-3">
          {stats.map((s, i) => (
            <div key={i} className="min-w-0 rounded-[14px] px-3.5 pb-3 pt-3.5" style={{ background: tileBg, boxShadow: MINT_RING }}>
              <MintNumber value={s.value} onUpdate={updateStat ? (v) => updateStat(i, { value: v }) : undefined} className="block" style={{ fontFamily: MINT_DISPLAY, fontSize: "1.7rem", letterSpacing: "-0.035em", color: heading }} />
              <span className="mt-1.5 block text-[12px] leading-[1.35]" style={{ color: muted }}>
                <InlineText as="span" value={s.label} onUpdate={updateStat ? (v) => updateStat(i, { label: v }) : undefined} />
              </span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );

  return (
    <section
      ref={ref}
      id={p.anchorId || undefined}
      data-block="mint-story"
      className="mint-story relative overflow-hidden"
      style={{ background: pal.bg, color: ink, fontFamily: MINT_BODY, ...MINT_SECTION_PAD }}
    >
      <style>{MINT_CSS}</style>
      <style>{`
        [data-block="mint-story"] .mint-ctrl button { transition: background .2s; }
        @media (hover: hover) { [data-block="mint-story"] .mint-ctrl button:hover { background: rgba(255,255,255,.12); } }
        @media (hover: hover) and (prefers-reduced-motion: no-preference) {
          [data-block="mint-story"] .mint-player:not(.playing):hover .mint-poster-img { transform: scale(1.03); }
          [data-block="mint-story"] .mint-player:not(.playing):hover .mint-big { transform: translate(-50%, -50%) scale(1.06); }
        }
      `}</style>
      <div className={MINT_WIDE}>
        <MintSectionHeader
          eyebrow={(p.eyebrow || isEditor) ? (
            <motion.div {...rise(0, 14)}>
              <MintEyebrow
                palette={pal}
                suffix={(p.eyebrowSuffix || isEditor) ? <InlineText as="span" value={p.eyebrowSuffix ?? ""} onUpdate={field("eyebrowSuffix")} /> : undefined}
              >
                <InlineText as="span" value={p.eyebrow ?? ""} onUpdate={field("eyebrow")} />
              </MintEyebrow>
            </motion.div>
          ) : undefined}
          headline={(
            <motion.h2 {...rise(0.05, 18)} className="max-w-[20ch]" style={mintDisplay("clamp(1.9rem, 3.6vw, 3rem)", heading)}>
              <InlineText as="span" value={p.headline} onUpdate={field("headline")} multiline />
            </motion.h2>
          )}
          link={(p.linkText || isEditor) ? (
            <motion.div {...rise(0.15, 14)}>
              <MintLink href={isEditor ? undefined : (p.linkUrl || "#")} onClick={isEditor ? (e) => e.preventDefault() : mintAnchorClick(p.linkUrl)} color={linkInk} size={15} className="whitespace-nowrap">
                <InlineText as="span" value={p.linkText ?? ""} onUpdate={field("linkText")} />
              </MintLink>
            </motion.div>
          ) : undefined}
        />
        <div className="grid items-center gap-8 min-[900px]:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] min-[900px]:gap-14">
          {player}
          {copy}
        </div>
      </div>
    </section>
  );
}
