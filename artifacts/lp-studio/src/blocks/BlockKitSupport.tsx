import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ArrowUpRight, FileDown } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { useAnimInitial } from "@/lib/reveal-fallback";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { BlendMedia, type MediaPlayMode } from "@/lib/glow-media";
import { INVITE_BODY, INVITE_CSS, INVITE_PILL_CLASS, Kicker, displayStyle, pillStyle, resolveInvitePalette } from "@/lib/invite-theme";

/* ----------------------------------------------------------------------------
 * Kit Support — type "kit-support"
 *
 * The close of a kit page, centered: "NEED A HAND?", a headline, a sentence,
 * a text link to the in-depth guide (PDF / doc), two pill CTAs side by side
 * (see the lab in person · talk to sales), and beneath them a wide framed
 * photo — or an ambient clip — of the lab that fades into the surface, the
 * thing the first CTA promises. The clip slot is `mediaVideoUrl` (NOT
 * `videoUrl`, which on a block with ctaText/ctaUrl is the Page CTA's
 * video-modal slot); the image doubles as its poster.
 *
 * `ctaText`/`ctaUrl` is the primary button and follows the Page CTA;
 * `ctaSecondaryText`/`ctaSecondaryUrl` is the official secondary alias
 * family so the Page CTA never rewrites it; `guideText`/`guideUrl` is a plain
 * link. All three render only when both their text and URL are set (editor
 * shows them regardless so they can be filled in).
 * -------------------------------------------------------------------------- */

export interface KitSupportBlockProps {
  kicker?: string;
  headline?: string;
  body?: string;
  /** Text link to the in-depth guide (PDF, doc, help page). */
  guideText?: string;
  guideUrl?: string;
  ctaText?: string;
  ctaUrl?: string;
  ctaSecondaryText?: string;
  ctaSecondaryUrl?: string;
  /** Optional ambient clip under the CTAs (mp4/webm, or YouTube / Vimeo / Wistia). Plays muted, loops, pauses off screen. */
  mediaVideoUrl?: string;
  mediaPlayMode?: MediaPlayMode;
  /** The lab photo under the CTAs — the clip's poster when a clip is set. */
  imageUrl?: string;
  imageAlt?: string;
  imageCaption?: string;
  anchorId?: string;
  bgColor?: string;
  accentColor?: string;
  textColor?: string;
}

interface Props {
  props: KitSupportBlockProps;
  brand: BrandConfig;
  onCtaClick?: () => void;
  onFieldChange?: (updated: KitSupportBlockProps) => void;
}

export const KIT_SUPPORT_DEFAULT_PROPS: KitSupportBlockProps = {
  kicker: "Need a hand?",
  headline: "Stuck on a step?\nWe'll get you in.",
  body: "The full guide walks through every screen. And when your team has seen the tour, come see the real thing.",
  guideText: "Download the step-by-step guide",
  guideUrl: "",
  ctaText: "See the lab in person",
  ctaUrl: "",
  ctaSecondaryText: "Talk to sales",
  ctaSecondaryUrl: "",
  mediaVideoUrl: "",
  mediaPlayMode: "inview",
  imageUrl: "",
  imageAlt: "",
  imageCaption: "",
  anchorId: "help",
};

const external = (url?: string) => !!url && !url.startsWith("#") && !url.startsWith("mailto:") && !url.startsWith("tel:");

export function BlockKitSupport({ props, brand, onCtaClick, onFieldChange }: Props) {
  const reduced = useReducedMotion() ?? false;
  const anim = useAnimInitial();
  const pal = resolveInvitePalette(props, brand);
  const isEditor = !!onFieldChange;

  const field = (key: keyof KitSupportBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as KitSupportBlockProps[typeof key] }) : undefined;

  const showGuide = isEditor || (!!props.guideText && !!props.guideUrl);
  const showPrimary = isEditor || (!!props.ctaText && !!props.ctaUrl);
  const showSecondary = isEditor || (!!props.ctaSecondaryText && !!props.ctaSecondaryUrl);
  const hasVideo = !!props.mediaVideoUrl;
  const showImage = isEditor || !!props.imageUrl || hasVideo;

  const rise = (delay: number) => ({
    initial: reduced ? false : anim({ opacity: 0, y: 16 }),
    whileInView: reduced ? undefined : { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-60px" },
    transition: { duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] as const },
  });

  return (
    <section id={props.anchorId || "help"} className="relative overflow-hidden" style={{ background: pal.bg, color: pal.text, fontFamily: INVITE_BODY }}>
      <style>{INVITE_CSS}</style>
      <div className="pointer-events-none absolute inset-0" aria-hidden="true" style={{ background: `radial-gradient(60% 40% at 50% 0%, color-mix(in srgb, ${pal.accent} 10%, transparent) 0%, transparent 70%)` }} />
      <div className="relative mx-auto w-full max-w-[1240px] px-6 pt-20 lg:px-10 lg:pt-28" style={{ paddingBottom: showImage ? 0 : undefined }}>
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          {(props.kicker || isEditor) && (
            <motion.div {...rise(0)} className="mb-6">
              <Kicker palette={pal}><InlineText as="span" value={props.kicker ?? ""} onUpdate={field("kicker")} /></Kicker>
            </motion.div>
          )}
          <motion.h2 {...rise(0.06)} className="max-w-[16ch] whitespace-pre-line" style={displayStyle("clamp(2.4rem, 5vw, 4.2rem)")}>
            <InlineText as="span" value={props.headline ?? ""} onUpdate={field("headline")} multiline />
          </motion.h2>
          {(props.body || isEditor) && (
            <motion.p {...rise(0.12)} className="mt-6 max-w-[50ch] text-[15px] leading-relaxed lg:text-base" style={{ color: pal.muted }}>
              <InlineText as="span" value={props.body ?? ""} onUpdate={field("body")} multiline />
            </motion.p>
          )}

          {showGuide && (
            <motion.div {...rise(0.18)} className="mt-7">
              <a
                href={props.guideUrl || "#"}
                target={external(props.guideUrl) ? "_blank" : undefined}
                rel={external(props.guideUrl) ? "noopener noreferrer" : undefined}
                className="kit-guide inline-flex min-h-[44px] items-center gap-2 text-[15px] font-semibold underline decoration-1 underline-offset-[6px]"
                style={{ color: pal.accent, textDecorationColor: `color-mix(in srgb, ${pal.accent} 55%, transparent)` }}
              >
                <FileDown className="h-4 w-4" aria-hidden />
                <InlineText as="span" value={props.guideText ?? ""} onUpdate={field("guideText")} />
              </a>
            </motion.div>
          )}

          {(showPrimary || showSecondary) && (
            <motion.div {...rise(0.24)} className="mt-9 flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center">
              {showPrimary && (
                <a
                  href={props.ctaUrl || "#"}
                  onClick={() => onCtaClick?.()}
                  target={external(props.ctaUrl) ? "_blank" : undefined}
                  rel={external(props.ctaUrl) ? "noopener noreferrer" : undefined}
                  className={INVITE_PILL_CLASS}
                  style={pillStyle(pal)}
                >
                  <InlineText as="span" value={props.ctaText ?? ""} onUpdate={field("ctaText")} />
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </a>
              )}
              {showSecondary && (
                <a
                  href={props.ctaSecondaryUrl || "#"}
                  target={external(props.ctaSecondaryUrl) ? "_blank" : undefined}
                  rel={external(props.ctaSecondaryUrl) ? "noopener noreferrer" : undefined}
                  className={INVITE_PILL_CLASS}
                  style={pillStyle(pal, "ghost")}
                >
                  <InlineText as="span" value={props.ctaSecondaryText ?? ""} onUpdate={field("ctaSecondaryText")} />
                  <ArrowUpRight className="h-4 w-4" aria-hidden />
                </a>
              )}
            </motion.div>
          )}
        </div>

        {showImage && (
          <motion.figure
            initial={reduced ? false : anim({ opacity: 0, y: 28 })}
            whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.9, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="relative mx-auto mt-14 w-full max-w-[1100px] lg:mt-20"
          >
            <div
              className="relative overflow-hidden rounded-t-[26px]"
              style={{
                aspectRatio: "16 / 8",
                background: pal.panel,
                border: `1px solid ${pal.hairline}`,
                borderBottom: "none",
                boxShadow: `0 -30px 90px -50px color-mix(in srgb, ${pal.accent} 35%, transparent)`,
              }}
            >
              {hasVideo ? (
                <BlendMedia
                  videoUrl={props.mediaVideoUrl}
                  imageUrl={props.imageUrl}
                  imageAlt={props.imageAlt}
                  blend="none"
                  edgeFade={false}
                  fit="cover"
                  playMode={props.mediaPlayMode ?? "inview"}
                  palette={{ dark: true, accent: pal.accent, glow: pal.accent }}
                  title={props.imageCaption || props.headline}
                  className="absolute inset-0 h-full"
                  style={{ aspectRatio: "auto" }}
                  onImageUpdate={field("imageUrl")}
                  onAltUpdate={field("imageAlt")}
                />
              ) : (
                <InlineImage
                  src={props.imageUrl ?? ""}
                  alt={props.imageAlt ?? ""}
                  onUpdate={field("imageUrl")}
                  onAltUpdate={field("imageAlt")}
                  wrapperClassName="absolute inset-0"
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              )}
              {/* Fade the media into the surface so the section ends on the brand colour, not a hard edge. */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[45%]" aria-hidden="true" style={{ background: `linear-gradient(180deg, transparent, ${pal.bg})` }} />
              {(props.imageCaption || isEditor) && (
                <figcaption className="absolute inset-x-0 bottom-0 flex items-center gap-3 px-6 pb-6 text-[11px] font-semibold uppercase tracking-[0.24em] lg:px-8 lg:pb-8" style={{ color: pal.faint }}>
                  <span aria-hidden="true" className="block h-px w-6" style={{ background: pal.accent, opacity: 0.8 }} />
                  <InlineText as="span" value={props.imageCaption ?? ""} onUpdate={field("imageCaption")} />
                </figcaption>
              )}
            </div>
          </motion.figure>
        )}
        {!showImage && <div className="h-20 lg:h-28" aria-hidden="true" />}
      </div>
    </section>
  );
}
