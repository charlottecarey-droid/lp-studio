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
  FOREST_BODY, FOREST_CONTAINER, FOREST_CSS, FOREST_CTA_DEFAULTS, FOREST_DISPLAY, FOREST_RING, FOREST_RING_DARK, FOREST_SECTION_PAD,
  ForestCtaButtons, ForestEyebrow, ForestNumber, resolveForestPalette, useForestReveal,
  type ForestCtaProps, type ForestStyleProps,
} from "./forest/forest-theme";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Forest Story — type "forest-story"  (DSO Page family, Nov 2026)
 *
 * The artifact's video customer story: a sand band with a 7/5 grid. Left, a
 * 16:10 poster in the v2 "frame" treatment (ring + layered shadow + an inner
 * 1px white highlight): photo, scrim, a tag pill top-left ("Film · 3:40"),
 * an 84px accent play disc with a pulsing ring and a caption row (title +
 * sub). Right, the eyebrow, the quote set in the display face with an accent
 * opening mark, the cite with a 36px avatar-initial disc (bold role + org)
 * and up to three outcome numbers as small ringed sand tiles in a grid.
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
  /** Letter in the 36px avatar disc beside the cite; blank = the first letter of the organisation. */
  citeInitial?: string;
  posterUrl?: string;
  posterAlt?: string;
  posterFocal?: string;
  /** Caption row on the poster: bold title + sub. */
  posterTitle?: string;
  posterSub?: string;
  /** Running time; shown in the tag pill when `tag` is blank ("Film · 3:40"). */
  duration?: string;
  /** Tag pill top-left of the poster; blank = "Film · {duration}". */
  tag?: string;
  /** Wistia, YouTube, Vimeo, Loom or a native mp4/webm/storage URL. Shared with a "video-modal" CTA action. */
  videoUrl?: string;
  /** "inline" swaps the player into the poster; "modal" opens a lightbox. */
  playMode?: "inline" | "modal";
  mediaSide?: "left" | "right";
  /** Up to three outcome numbers under the cite, as ringed tiles. */
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
  citeInitial: "",
  tag: "",
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
    { value: "2", label: "appointments per denture" },
    { value: "10K+", label: "appointments recaptured" },
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
  const stats = (p.stats ?? []).filter((s) => s.value?.trim() || isEditor).slice(0, 3);
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
  const ring = pal.dark ? FOREST_RING_DARK : FOREST_RING;
  const tagText = (p.tag ?? "").trim() || (p.duration ? `Film · ${p.duration}` : "");
  const initial = (p.citeInitial ?? "").trim().slice(0, 2) || (p.citeOrg ?? "").trim().charAt(0).toUpperCase();

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
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: `linear-gradient(180deg, color-mix(in srgb, ${posterBg} 10%, transparent), transparent 35%, color-mix(in srgb, ${posterBg} 72%, transparent))` }} />
      {/* Tag pill */}
      {(tagText || isEditor) && (
        <span className="absolute left-[18px] top-[18px] z-[2] inline-flex items-center rounded-full px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: cream, background: `color-mix(in srgb, ${posterBg} 50%, transparent)`, border: "1px solid rgba(255,252,239,0.14)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
          <InlineText as="span" value={tagText} onUpdate={field("tag")} />
        </span>
      )}
      {/* Play disc */}
      {isEditor ? (
        <button type="button" onClick={play} aria-label={canPlay ? `Play the ${title} story` : "Add a video in the panel to play"} className="forest-play absolute left-1/2 top-1/2 z-[2] grid h-16 w-16 -translate-x-1/2 -translate-y-[62%] place-items-center rounded-full sm:h-[84px] sm:w-[84px] sm:-translate-y-1/2" style={{ background: pal.accentDeco, color: pal.onAccent, boxShadow: "0 10px 40px rgba(0,0,0,.25)", cursor: canPlay ? "pointer" : "default" }}>
          {!reduced && !staticRender && <span aria-hidden className="forest-ring absolute -inset-[14px] rounded-full" style={{ border: `1px solid color-mix(in srgb, ${pal.accentDeco} 50%, transparent)` }} />}
          <Play className="relative ml-1 h-5 w-5 sm:h-[26px] sm:w-[26px]" fill="currentColor" strokeWidth={0} aria-hidden />
        </button>
      ) : (
        <span aria-hidden className="forest-play absolute left-1/2 top-1/2 z-[2] grid h-16 w-16 -translate-x-1/2 -translate-y-[62%] place-items-center rounded-full sm:h-[84px] sm:w-[84px] sm:-translate-y-1/2" style={{ background: pal.accentDeco, color: pal.onAccent, boxShadow: "0 10px 40px rgba(0,0,0,.25)" }}>
          {!reduced && !staticRender && <span className="forest-ring absolute -inset-[14px] rounded-full" style={{ border: `1px solid color-mix(in srgb, ${pal.accentDeco} 50%, transparent)` }} />}
          <Play className="relative ml-1 h-5 w-5 sm:h-[26px] sm:w-[26px]" fill="currentColor" strokeWidth={0} />
        </span>
      )}
      {/* Caption row */}
      <div className="absolute bottom-[22px] left-[22px] right-[22px] z-[2] flex items-end justify-between gap-4 text-[13px]" style={{ color: cream }}>
        <div className="min-w-0">
          {(p.posterTitle || isEditor) && (
            <b className="block" style={{ fontFamily: FOREST_DISPLAY, fontSize: "1.2rem", letterSpacing: "-0.02em", fontWeight: 400, lineHeight: 1.2 }}>
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
      {/* Inner 1px highlight (the v2 `.frame::after`) */}
      <span aria-hidden className="pointer-events-none absolute inset-0 z-[3] rounded-[inherit]" style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.18)" }} />
    </>
  );

  const posterClass = "group relative block w-full overflow-hidden rounded-[20px] text-left";
  const posterStyle: React.CSSProperties = { aspectRatio: "16 / 10", background: posterBg, boxShadow: `${ring}, 0 2px 6px rgba(0,38,31,.05), 0 24px 60px rgba(0,0,0,.14)` };

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
      <p className="mt-[18px]" style={{ fontFamily: FOREST_DISPLAY, fontSize: "clamp(1.4rem, 2.2vw, 1.9rem)", lineHeight: 1.22, letterSpacing: "-0.025em", color: pal.heading, fontWeight: 400, margin: "18px 0 0" }}>
        <span aria-hidden style={{ color: pal.accentDeco }}>“</span>
        <InlineText as="span" value={p.quote} onUpdate={field("quote")} multiline />
        <span aria-hidden>”</span>
      </p>
      {(p.citeRole || p.citeOrg || isEditor) && (
        <div className="mt-[18px] flex items-center gap-3 text-[14px]" style={{ color: pal.muted }}>
          {(initial || isEditor) && (
            <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[14px]" style={{ background: `color-mix(in srgb, ${pal.heading} 9%, ${pal.card})`, color: pal.heading, fontFamily: FOREST_DISPLAY, boxShadow: ring }}>
              <InlineText as="span" value={initial} onUpdate={field("citeInitial")} />
            </span>
          )}
          <p className="m-0 min-w-0">
            {(p.citeRole || isEditor) && (
              <b className="block font-medium" style={{ color: pal.text }}>
                <InlineText as="span" value={p.citeRole ?? ""} onUpdate={field("citeRole")} />
              </b>
            )}
            {(p.citeOrg || isEditor) && <InlineText as="span" value={p.citeOrg ?? ""} onUpdate={field("citeOrg")} />}
          </p>
        </div>
      )}
      {stats.length > 0 && (
        <div className={cn("mt-[26px] grid gap-3", stats.length === 1 ? "grid-cols-1" : stats.length === 2 ? "grid-cols-2" : "grid-cols-1 min-[440px]:grid-cols-3")}>
          {stats.map((s, i) => (
            <div key={i} className="min-w-0 rounded-[14px] px-3.5 pb-3 pt-3.5" style={{ background: pal.dark ? pal.panel : `color-mix(in srgb, ${pal.card} 62%, ${pal.base})`, boxShadow: ring }}>
              <ForestNumber value={s.value} onUpdate={updateStat ? (v) => updateStat(i, { value: v }) : undefined} className="block" style={{ fontFamily: FOREST_DISPLAY, fontSize: "1.7rem", letterSpacing: "-0.035em", color: pal.heading }} />
              <span className="mt-1.5 block text-[12px] leading-[1.35]" style={{ color: pal.muted }}>
                <InlineText as="span" value={s.label} onUpdate={updateStat ? (v) => updateStat(i, { label: v }) : undefined} />
              </span>
            </div>
          ))}
        </div>
      )}
      {(p.ctaText || isEditor) && (
        <div className="mt-7">
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
