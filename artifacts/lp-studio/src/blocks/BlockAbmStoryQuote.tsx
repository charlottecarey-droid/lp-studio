import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import { isValidHex, relativeLuminance } from "@/lib/brand-config";
import { useAnimInitial, useStaticRender } from "@/lib/reveal-fallback";
import { BlendMedia, isEmbedVideoUrl, type MediaPlayMode } from "@/lib/glow-media";
import { getAutoplayEmbedUrl } from "@/lib/video-utils";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { ABM_BODY, ABM_CONTAINER, ABM_CSS, AbmArrowLink, anchorClick, displayStyle, inksOn, resolveAbmPalette, type AbmStyleProps } from "@/lib/abm-theme";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * ABM Story Quote — type "abm-story-quote"
 *
 * The customer-story feature: a dark card (brand primary on a light section)
 * with a tracked "CUSTOMER STORY" kicker, a large quote, the speaker's name,
 * title and company wordmark and a "Read their story" arrow link, beside a
 * full-bleed photo. The two halves meet edge to edge like the reference page.
 *
 * The photo half can instead hold a clip (`mediaVideoUrl`): by default it
 * shows the photo as a thumbnail with a play button and plays WITH sound on
 * click ("click"); the other modes are the family's muted loops (inview /
 * hover / always) via BlendMedia. The photo is always the poster.
 * -------------------------------------------------------------------------- */

/** "click" = thumbnail + play button (sound on). The rest are muted loops. */
export type AbmStoryPlayMode = "click" | MediaPlayMode;

export interface AbmStoryQuoteBlockProps extends AbmStyleProps {
  kicker?: string;
  quote?: string;
  author?: string;
  role?: string;
  company?: string;
  /** Company wordmark shown in place of the company text (inverted to white on a dark card). */
  companyLogoUrl?: string;
  companyLogoAlt?: string;
  linkText?: string;
  linkUrl?: string;
  imageUrl?: string;
  imageAlt?: string;
  imageFocal?: string;
  imageSide?: "left" | "right";
  /** Customer clip shown in place of the photo (mp4 / webm, or a YouTube / Vimeo / Wistia / Loom link). The photo becomes its thumbnail / poster. */
  mediaVideoUrl?: string;
  /** How the clip plays. Default "click". */
  mediaPlayMode?: AbmStoryPlayMode;
  /** The quote card's colour. Blank = brand primary (or a tinted light card on dark sections). */
  cardColor?: string;
  anchorId?: string;
}

interface Props {
  props: AbmStoryQuoteBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: AbmStoryQuoteBlockProps) => void;
}

export const ABM_STORY_QUOTE_DEFAULT_PROPS: AbmStoryQuoteBlockProps = {
  kicker: "Customer story",
  quote: "I couldn't recommend it any more than I already have. It's clear what the status of something is, for everyone.",
  author: "Project manager",
  role: "Enterprise customer",
  company: "",
  companyLogoUrl: "",
  linkText: "Read their story",
  linkUrl: "#",
  imageUrl: "",
  imageAlt: "",
  imageSide: "right",
  mediaVideoUrl: "",
  mediaPlayMode: "click",
  anchorId: "proof",
  backgroundStyle: "white",
};

/** Sound-on variant of the autoplay embed URL for a user-initiated play. */
function clickPlayEmbedUrl(url: string): string {
  const auto = getAutoplayEmbedUrl(url);
  try {
    const u = new URL(auto);
    if (u.searchParams.has("mute")) u.searchParams.set("mute", "0");
    if (u.searchParams.has("muted")) u.searchParams.set("muted", "0");
    u.searchParams.delete("loop");
    u.searchParams.delete("playlist");
    return u.toString();
  } catch {
    return auto;
  }
}

export function BlockAbmStoryQuote({ props, brand, onFieldChange }: Props) {
  const reduced = useReducedMotion() ?? false;
  const anim = useAnimInitial();
  const staticRender = useStaticRender();
  const [playing, setPlaying] = useState(false);
  const pal = resolveAbmPalette(props, brand, "#FFFFFF");
  const isEditor = !!onFieldChange;
  const card = props.cardColor && isValidHex(props.cardColor) ? props.cardColor : pal.contrastCard;
  const cardDark = isValidHex(card) ? relativeLuminance(card) < 0.4 : pal.contrastCardDark;
  const cardInk = inksOn(isValidHex(card) ? card : cardDark ? "#0B0B0F" : "#FFFFFF");
  const imageRight = (props.imageSide ?? "right") === "right";
  const videoUrl = (props.mediaVideoUrl ?? "").trim();
  const playMode: AbmStoryPlayMode = props.mediaPlayMode ?? "click";
  const videoEmbed = !!videoUrl && isEmbedVideoUrl(videoUrl);
  const mediaAlt = props.imageAlt || props.company || "Customer story";

  const field = (key: keyof AbmStoryQuoteBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as AbmStoryQuoteBlockProps[typeof key] }) : undefined;

  const reveal = (delay: number) => ({
    initial: reduced ? false : anim({ opacity: 0, y: 16 }),
    whileInView: reduced ? undefined : { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-60px" },
    transition: { duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] as const },
  });

  return (
    <section id={props.anchorId || undefined} className="abm-story-quote relative overflow-hidden" style={{ background: pal.bg, color: pal.text, fontFamily: ABM_BODY }}>
      <style>{ABM_CSS}</style>
      <div className={cn(ABM_CONTAINER, "py-12 lg:py-16")}>
        <motion.div {...reveal(0)} className="grid grid-cols-1 overflow-hidden lg:grid-cols-2" style={{ borderRadius: 4, boxShadow: "0 30px 60px -40px rgba(0,0,0,0.45)" }}>
          <div className={cn("flex flex-col justify-between gap-10 p-9 sm:p-12 lg:min-h-[520px] lg:p-14", imageRight ? "" : "lg:order-last")} style={{ background: card, color: cardInk.text }}>
            <div>
              {(props.kicker || isEditor) && (
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: cardInk.muted }}>
                  <InlineText as="span" value={props.kicker ?? ""} onUpdate={field("kicker")} />
                </p>
              )}
              <blockquote className="mt-7">
                <p style={displayStyle("clamp(1.5rem, 2.4vw, 2rem)", cardInk.text, 600)}>
                  <InlineText as="span" value={props.quote ? `“${props.quote}”` : ""} onUpdate={onFieldChange ? (v) => onFieldChange({ ...props, quote: v.replace(/^[“"]/, "").replace(/[”"]$/, "") }) : undefined} multiline />
                </p>
              </blockquote>
            </div>
            <div className="flex flex-col gap-6">
              <div>
                {(props.author || isEditor) && (
                  <p className="text-[16px] font-semibold" style={{ color: cardInk.text }}>
                    <InlineText as="span" value={props.author ?? ""} onUpdate={field("author")} />
                  </p>
                )}
                {(props.role || isEditor) && (
                  <p className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.18em]" style={{ color: cardInk.muted }}>
                    <InlineText as="span" value={props.role ?? ""} onUpdate={field("role")} />
                  </p>
                )}
                {props.companyLogoUrl ? (
                  <img src={props.companyLogoUrl} alt={props.companyLogoAlt || props.company || "Company"} className="mt-4 h-5 w-auto max-w-[160px] object-contain object-left" style={{ filter: cardDark ? "brightness(0) invert(1)" : "none" }} loading="lazy" />
                ) : (props.company || isEditor) ? (
                  <p className="mt-3 text-[13px] font-bold uppercase tracking-[0.14em]" style={{ color: cardInk.text }}>
                    <InlineText as="span" value={props.company ?? ""} onUpdate={field("company")} />
                  </p>
                ) : null}
              </div>
              {(props.linkText || isEditor) && (
                <AbmArrowLink href={props.linkUrl} onClick={anchorClick(props.linkUrl)} color={cardInk.text}>
                  <InlineText as="span" value={props.linkText ?? ""} onUpdate={field("linkText")} />
                </AbmArrowLink>
              )}
            </div>
          </div>
          <div className="relative min-h-[280px] lg:min-h-[520px]" style={{ background: pal.panel }}>
            {videoUrl && playMode !== "click" ? (
              <div className="absolute inset-0">
                <BlendMedia
                  videoUrl={videoUrl}
                  imageUrl={props.imageUrl}
                  imageAlt={mediaAlt}
                  imageFocal={props.imageFocal}
                  blend="none"
                  edgeFade={false}
                  fit="cover"
                  playMode={playMode}
                  palette={{ dark: false, accent: pal.accentDeco, glow: pal.accentDeco }}
                  placeholder="board"
                  className="h-full w-full"
                  style={{ aspectRatio: "auto", height: "100%" }}
                  title={mediaAlt}
                  onImageUpdate={field("imageUrl")}
                  onAltUpdate={field("imageAlt")}
                  onFocalUpdate={field("imageFocal")}
                />
              </div>
            ) : videoUrl && playing && !staticRender ? (
              videoEmbed ? (
                <iframe
                  src={clickPlayEmbedUrl(videoUrl)}
                  className="absolute inset-0 h-full w-full border-0"
                  title={mediaAlt}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video
                  src={videoUrl}
                  poster={props.imageUrl || undefined}
                  className="absolute inset-0 h-full w-full object-cover"
                  style={{ objectPosition: props.imageFocal }}
                  autoPlay
                  controls
                  playsInline
                  preload="metadata"
                  aria-label={mediaAlt}
                  onEnded={() => setPlaying(false)}
                />
              )
            ) : (
              <>
                {(props.imageUrl || isEditor) ? (
                  <InlineImage
                    src={props.imageUrl ?? ""}
                    alt={mediaAlt}
                    className="absolute inset-0 h-full w-full object-cover"
                    wrapperClassName="absolute inset-0"
                    loading="lazy"
                    focalPoint={props.imageFocal}
                    onUpdate={field("imageUrl")}
                    onAltUpdate={field("imageAlt")}
                    onFocalUpdate={field("imageFocal")}
                  />
                ) : videoUrl && !videoEmbed ? (
                  // No thumbnail set: the clip's first frame stands in for it.
                  <video src={videoUrl} className="absolute inset-0 h-full w-full object-cover" muted playsInline preload="metadata" aria-hidden />
                ) : (
                  <div aria-hidden className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${pal.panel} 0%, color-mix(in srgb, ${pal.accentDeco} 18%, ${pal.panel}) 100%)` }} />
                )}
                {videoUrl && (
                  <button
                    type="button"
                    onClick={() => setPlaying(true)}
                    aria-label="Play video"
                    data-abm-story-play
                    // In the editor only the disc is clickable so the thumbnail stays inline-editable around it.
                    className={cn("group flex items-center justify-center", isEditor ? "absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2" : "absolute inset-0 h-full w-full")}
                  >
                    {!isEditor && <span aria-hidden className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />}
                    <motion.span
                      className="relative flex h-20 w-20 items-center justify-center rounded-full"
                      style={{
                        background: "rgba(255,255,255,0.18)",
                        backdropFilter: "blur(10px)",
                        WebkitBackdropFilter: "blur(10px)",
                        border: "1.5px solid rgba(255,255,255,0.6)",
                        boxShadow: "0 8px 32px rgba(0,0,0,0.22)",
                      }}
                      whileHover={reduced ? undefined : { scale: 1.08 }}
                      whileTap={reduced ? undefined : { scale: 0.95 }}
                    >
                      <svg className="h-7 w-7 text-white drop-shadow" style={{ marginLeft: 3 }} fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <polygon points="5,3 19,12 5,21" />
                      </svg>
                    </motion.span>
                  </button>
                )}
              </>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
