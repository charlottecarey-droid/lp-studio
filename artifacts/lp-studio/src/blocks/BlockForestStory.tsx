import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Play, X } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { useStaticRender } from "@/lib/reveal-fallback";
import { extractWistiaId, wistiaIframeUrl } from "@/lib/wistia";
import { getAutoplayEmbedUrl, isNativeVideoUrl } from "@/lib/video-utils";
import { VideoModal } from "@/components/VideoModal";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import {
  FOREST_BODY, FOREST_CONTAINER, FOREST_CSS, FOREST_CTA_DEFAULTS, FOREST_DISPLAY, FOREST_SECTION_PAD,
  ForestCtaButtons, ForestEyebrow, ForestNumber, resolveForestPalette, useForestReveal,
  type ForestCtaProps, type ForestStyleProps,
} from "./forest/forest-theme";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Forest Story — type "forest-story"  (DSO Page family, Nov 2026)
 *
 * The artifact's video customer story: a sand band with a 7/5 grid. Left, a
 * 16:10 elevated poster (photo, scrim, an 84px accent play disc with a
 * pulsing ring, a caption row: title + sub left, duration right). Right, the
 * eyebrow, the quote set in the display face with an accent opening mark,
 * the cite (bold role + org) and a two-up stat row under a hairline.
 *
 * Clicking the poster plays `videoUrl`: Wistia → iframe, native mp4/webm/
 * storage URL → <video>, YouTube/Vimeo/Loom → autoplay embed. `playMode`
 * "inline" swaps the player into the poster; "modal" opens VideoModal.
 * -------------------------------------------------------------------------- */

export interface ForestStoryStat {
  value: string;
  label: string;
}

export interface ForestStoryBlockProps extends ForestStyleProps, ForestCtaProps {
  eyebrow?: string;
  /** The pull quote (no quote marks — they are drawn). */
  quote: string;
  citeRole?: string;
  citeOrg?: string;
  posterUrl?: string;
  posterAlt?: string;
  posterFocal?: string;
  /** Caption row on the poster: bold title + sub (left), duration (right). */
  posterTitle?: string;
  posterSub?: string;
  duration?: string;
  /** Wistia, YouTube, Vimeo, Loom or a native mp4/webm/storage URL. Shared with a "video-modal" CTA action. */
  videoUrl?: string;
  /** "inline" swaps the player into the poster; "modal" opens a lightbox. */
  playMode?: "inline" | "modal";
  mediaSide?: "left" | "right";
  /** Up to two outcome numbers under the cite. */
  stats?: ForestStoryStat[];
  anchorId?: string;
}

interface Props {
  props: ForestStoryBlockProps;
  brand: BrandConfig;
  pageId?: number;
  variantId?: number;
  onCtaClick?: () => void;
  onFieldChange?: (updated: ForestStoryBlockProps) => void;
}

export const FOREST_STORY_DEFAULT_PROPS: ForestStoryBlockProps = {
  ...FOREST_CTA_DEFAULTS,
  eyebrow: "Customer story",
  quote: "We stopped asking doctors to change labs. We gave them a lab they would have chosen anyway, and the schedule took care of itself.",
  citeRole: "Chief Clinical Officer",
  citeOrg: "Northwind Health",
  posterUrl: "",
  posterAlt: "",
  posterTitle: "Northwind Health",
  posterSub: "How a mobile dental group rebuilt dentures around two appointments",
  duration: "3:40",
  videoUrl: "",
  playMode: "inline",
  mediaSide: "left",
  stats: [
    { value: "40%", label: "faster denture turnaround" },
    { value: "2", label: "appointments per denture, down from four or more" },
  ],
  anchorId: "story",
  backgroundStyle: "muted",
};

function isNativeStoryVideo(url: string): boolean {
  return isNativeVideoUrl(url) || /\.(m4v)(\?|#|$)/i.test(url) || url.startsWith("/api/storage/");
}

export function BlockForestStory({ props, brand, pageId, variantId, onCtaClick, onFieldChange }: Props) {
  const p = { ...FOREST_STORY_DEFAULT_PROPS, ...props };
  const pal = resolveForestPalette(p, brand, "#F6F4EE");
  const isEditor = !!onFieldChange;
  const reduced = useReducedMotion() ?? false;
  const staticRender = useStaticRender();
  const { ref, rise } = useForestReveal<HTMLElement>();
  const [playing, setPlaying] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const field = (key: keyof ForestStoryBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as ForestStoryBlockProps[typeof key] }) : undefined;
  const stats = (p.stats ?? []).filter((s) => s.value?.trim() || isEditor).slice(0, 2);
  const updateStat = onFieldChange
    ? (i: number, patch: Partial<ForestStoryStat>) => onFieldChange({ ...props, stats: (p.stats ?? []).map((s, idx) => (idx === i ? { ...s, ...patch } : s)) })
    : undefined;

  const videoUrl = (p.videoUrl ?? "").trim();
  const wistiaId = videoUrl ? extractWistiaId(videoUrl) : null;
  const native = !!videoUrl && !wistiaId && isNativeStoryVideo(videoUrl);
  const embedUrl = videoUrl && !wistiaId && !native ? getAutoplayEmbedUrl(videoUrl) : "";
  const canPlay = !!videoUrl && (!!wistiaId || native || embedUrl !== videoUrl);
  const modal = p.playMode === "modal";
  const title = p.posterTitle || p.citeOrg || "Customer story";
  const play = () => {
    if (!canPlay) return;
    if (modal) setModalOpen(true);
    else setPlaying(true);
  };

  // The poster is painted in the brand primary (the artifact's --green) with
  // a scrim of the same hue, so cream caption text reads on any photo.
  const posterBg = pal.contrastCardDark ? pal.contrastCard : pal.deep;
  const cream = "#FFFCEF";
  const creamMuted = "rgba(255,252,239,0.66)";
  const mediaRight = p.mediaSide === "right";

  const player = playing && !modal && (
    <>
      {wistiaId ? (
        <iframe src={wistiaIframeUrl(wistiaId, { autoPlay: true })} allow="autoplay; fullscreen" allowFullScreen title={`${title} story`} className="absolute inset-0 h-full w-full border-0" />
      ) : native ? (
        <video src={videoUrl} poster={p.posterUrl || undefined} controls autoPlay playsInline className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <iframe src={embedUrl} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen title={`${title} story`} className="absolute inset-0 h-full w-full border-0" />
      )}
      {isEditor && (
        <button type="button" onClick={() => setPlaying(false)} aria-label="Back to the poster" className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full" style={{ background: "rgba(0,0,0,0.55)", color: "#fff" }}>
          <X className="h-4 w-4" />
        </button>
      )}
    </>
  );

  const posterInner = (
    <>
      {(p.posterUrl || isEditor) ? (
        <InlineImage
          src={p.posterUrl ?? ""}
          alt={p.posterAlt || title}
          className="forest-poster-img h-full w-full object-cover"
          wrapperClassName="absolute inset-0"
          style={{ filter: "saturate(.85)", transition: reduced ? "none" : "transform 1.4s cubic-bezier(.16,1,.3,1)" }}
          focalPoint={p.posterFocal}
          onUpdate={field("posterUrl")}
          onAltUpdate={field("posterAlt")}
          onFocalUpdate={field("posterFocal")}
        />
      ) : (
        <div aria-hidden className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 30% 20%, color-mix(in srgb, ${pal.accentDeco} 18%, transparent), transparent 55%), linear-gradient(160deg, ${posterBg} 0%, color-mix(in srgb, ${posterBg} 70%, #000) 100%)` }} />
      )}
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: `linear-gradient(180deg, transparent 30%, color-mix(in srgb, ${posterBg} 75%, transparent))` }} />
      {/* Play disc */}
      {isEditor ? (
        <button type="button" onClick={play} aria-label={canPlay ? `Play the ${title} story` : "Add a video in the panel to play"} className="forest-play absolute left-1/2 top-1/2 z-[2] grid h-[84px] w-[84px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full" style={{ background: pal.accentDeco, color: pal.onAccent, boxShadow: "0 10px 40px rgba(0,0,0,.25)", cursor: canPlay ? "pointer" : "default" }}>
          {!reduced && !staticRender && <span aria-hidden className="forest-ring absolute -inset-[14px] rounded-full" style={{ border: `1px solid color-mix(in srgb, ${pal.accentDeco} 50%, transparent)` }} />}
          <Play className="relative ml-1 h-[26px] w-[26px]" fill="currentColor" strokeWidth={0} aria-hidden />
        </button>
      ) : (
        <span aria-hidden className="forest-play absolute left-1/2 top-1/2 z-[2] grid h-[84px] w-[84px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full" style={{ background: pal.accentDeco, color: pal.onAccent, boxShadow: "0 10px 40px rgba(0,0,0,.25)" }}>
          {!reduced && !staticRender && <span className="forest-ring absolute -inset-[14px] rounded-full" style={{ border: `1px solid color-mix(in srgb, ${pal.accentDeco} 50%, transparent)` }} />}
          <Play className="relative ml-1 h-[26px] w-[26px]" fill="currentColor" strokeWidth={0} />
        </span>
      )}
      {/* Caption row */}
      <div className="absolute bottom-6 left-7 right-7 z-[2] flex items-end justify-between gap-4 text-[13px]" style={{ color: cream }}>
        <div className="min-w-0">
          {(p.posterTitle || isEditor) && (
            <b className="block" style={{ fontFamily: FOREST_DISPLAY, fontSize: "1.25rem", letterSpacing: "-0.02em", fontWeight: 400, lineHeight: 1.2 }}>
              <InlineText as="span" value={p.posterTitle ?? ""} onUpdate={field("posterTitle")} />
            </b>
          )}
          {(p.posterSub || isEditor) && (
            <span className="block" style={{ color: creamMuted }}>
              <InlineText as="span" value={p.posterSub ?? ""} onUpdate={field("posterSub")} />
            </span>
          )}
        </div>
        {(p.duration || isEditor) && (
          <span className="shrink-0 tabular-nums" style={{ color: creamMuted }}>
            <InlineText as="span" value={p.duration ?? ""} onUpdate={field("duration")} />
          </span>
        )}
      </div>
    </>
  );

  const posterClass = "group relative block w-full overflow-hidden rounded-[28px] text-left";
  const posterStyle: React.CSSProperties = { aspectRatio: "16 / 10", background: posterBg, boxShadow: pal.shadowElev };

  const poster = (
    <motion.div {...rise(0)} className={cn(mediaRight && "min-[1000px]:order-2")}>
      {player ? (
        <div className={posterClass} style={posterStyle}>{player}</div>
      ) : isEditor || !canPlay ? (
        <div className={posterClass} style={posterStyle}>{posterInner}</div>
      ) : (
        <button type="button" onClick={play} aria-label={`Play the ${title} story`} className={cn(posterClass, "cursor-pointer border-0 p-0")} style={posterStyle}>
          {posterInner}
        </button>
      )}
    </motion.div>
  );

  const copy = (
    <motion.div {...rise(0.1)} className={cn(mediaRight && "min-[1000px]:order-1")}>
      {(p.eyebrow || isEditor) && (
        <ForestEyebrow palette={pal}>
          <InlineText as="span" value={p.eyebrow ?? ""} onUpdate={field("eyebrow")} />
        </ForestEyebrow>
      )}
      <p className="mt-[22px]" style={{ fontFamily: FOREST_DISPLAY, fontSize: "clamp(1.5rem, 2.4vw, 2rem)", lineHeight: 1.25, letterSpacing: "-0.025em", color: pal.heading, fontWeight: 400 }}>
        <span aria-hidden style={{ color: pal.accentDeco }}>“</span>
        <InlineText as="span" value={p.quote} onUpdate={field("quote")} multiline />
        <span aria-hidden>”</span>
      </p>
      {(p.citeRole || p.citeOrg || isEditor) && (
        <p className="mt-[22px] text-[14px]" style={{ color: pal.muted }}>
          {(p.citeRole || isEditor) && (
            <b className="block font-semibold" style={{ color: pal.text }}>
              <InlineText as="span" value={p.citeRole ?? ""} onUpdate={field("citeRole")} />
            </b>
          )}
          {(p.citeOrg || isEditor) && <InlineText as="span" value={p.citeOrg ?? ""} onUpdate={field("citeOrg")} />}
        </p>
      )}
      {stats.length > 0 && (
        <div className="mt-[34px] grid grid-cols-2 gap-5 pt-7" style={{ borderTop: `1px solid ${pal.hairline}` }}>
          {stats.map((s, i) => (
            <div key={i} className="min-w-0">
              <ForestNumber value={s.value} onUpdate={updateStat ? (v) => updateStat(i, { value: v }) : undefined} className="block" style={{ fontFamily: FOREST_DISPLAY, fontSize: "2rem", color: pal.heading }} />
              <span className="mt-2 block text-[13px] leading-[1.45]" style={{ color: pal.muted }}>
                <InlineText as="span" value={s.label} onUpdate={updateStat ? (v) => updateStat(i, { label: v }) : undefined} />
              </span>
            </div>
          ))}
        </div>
      )}
      {(p.ctaText || isEditor) && (
        <div className="mt-8">
          <ForestCtaButtons
            props={p}
            brand={brand}
            palette={pal}
            pageId={pageId}
            variantId={variantId}
            onCtaClick={onCtaClick}
            onLabelChange={onFieldChange ? (k, v) => onFieldChange({ ...props, [k]: v }) : undefined}
            source="forest-story"
            secondaryStyle="link"
            primaryPlaceholder="Read the full story"
            secondaryPlaceholder="Talk to the team"
          />
        </div>
      )}
    </motion.div>
  );

  return (
    <section
      ref={ref}
      id={p.anchorId || undefined}
      data-block="forest-story"
      className="forest-story relative overflow-hidden"
      style={{ background: pal.bg, color: pal.text, fontFamily: FOREST_BODY, ...FOREST_SECTION_PAD }}
    >
      <style>{FOREST_CSS}</style>
      <style>{`
        @keyframes forest-ring{0%{transform:scale(.8);opacity:0}40%{opacity:1}100%{transform:scale(1.35);opacity:0}}
        .forest-ring{animation:forest-ring 2.6s cubic-bezier(.16,1,.3,1) infinite}
        .forest-play{transition:transform .5s cubic-bezier(.16,1,.3,1)}
        @media (hover:hover) and (prefers-reduced-motion: no-preference){[data-block="forest-story"] .group:hover .forest-poster-img{transform:scale(1.04)} [data-block="forest-story"] .group:hover .forest-play{transform:translate(-50%,-50%) scale(1.08)}}
        @media (prefers-reduced-motion: reduce){.forest-ring{animation:none}}
      `}</style>
      <div className={cn(FOREST_CONTAINER, "grid items-center gap-9 min-[1000px]:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] min-[1000px]:gap-16")}>
        {poster}
        {copy}
      </div>
      {modal && (
        <VideoModal open={modalOpen} onClose={() => setModalOpen(false)} videoUrl={videoUrl} posterUrl={p.posterUrl || undefined} ariaLabel={`${title} story`} />
      )}
    </section>
  );
}
