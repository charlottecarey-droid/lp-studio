import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import type { CtaModalConfig } from "@/lib/block-types/common";
import type { HeroCtaActionMode, SocialProofLogo } from "@/lib/block-types/generic-blocks";
import { pickCtaModalConfig } from "@/lib/cta-modal";
import { useAnimInitial } from "@/lib/reveal-fallback";
import { IconOrImage } from "@/lib/icon-value";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { CtaButton } from "@/components/CtaButton";
import {
  BlendMedia,
  GlowPanel,
  GLOW_BODY,
  GLOW_DISPLAY,
  DISPLAY_TRACKING,
  resolveGlowPalette,
  type MediaAspect,
  type MediaBlend,
} from "@/lib/glow-media";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Glow Video Hero — type "glow-video-hero"
 *
 * Centered statement hero on warm paper: small icon eyebrow, oversized tight
 * display headline, one-line subheadline, pill CTA pair, then a wide product
 * video sitting in a gradient-glow panel whose bottom edge fades into the page
 * (the video reads as a graphic, not a player). An optional "trusted by" logo
 * row closes the block. Does NOT render a nav.
 * -------------------------------------------------------------------------- */

export interface GlowVideoHeroBlockProps extends CtaModalConfig {
  eyebrow?: string;
  /** Lucide icon name or image URL shown before the eyebrow. */
  eyebrowIcon?: string;
  headline?: string;
  subheadline?: string;
  align?: "center" | "left";

  ctaText?: string;
  ctaUrl?: string;
  ctaAction?: HeroCtaActionMode;
  chilipiperUrl?: string;
  /** Video for ctaAction === "video-modal" (NOT the hero graphic). */
  videoUrl?: string;
  videoPosterUrl?: string;
  ctaButtonColor?: string;
  ctaButtonTextColor?: string;
  ctaSecondaryText?: string;
  ctaSecondaryUrl?: string;
  ctaSecondaryAction?: HeroCtaActionMode;
  secondaryChilipiperUrl?: string;
  secondaryVideoUrl?: string;

  /** The hero graphic: a native mp4/webm (preferred) or an embed link. */
  mediaVideoUrl?: string;
  /** Poster for the video, or the graphic itself when no video is set. */
  mediaImageUrl?: string;
  mediaImageAlt?: string;
  mediaImageFocal?: string;
  mediaBlend?: MediaBlend;
  mediaEdgeFade?: boolean;
  mediaAspect?: MediaAspect;
  /** Show the "Play with sound" pill on native video. */
  showSoundToggle?: boolean;
  soundToggleLabel?: string;

  logosLabel?: string;
  logos?: SocialProofLogo[];

  bgColor?: string;
  textColor?: string;
  accentColor?: string;
  glowColor?: string;
}

interface Props {
  props: GlowVideoHeroBlockProps;
  brand: BrandConfig;
  pageId?: number;
  variantId?: number;
  onCtaClick?: () => void;
  onFieldChange?: (updated: GlowVideoHeroBlockProps) => void;
}

export const GLOW_VIDEO_HERO_DEFAULT_PROPS: GlowVideoHeroBlockProps = {
  eyebrow: "The operating system for modern teams",
  eyebrowIcon: "Sparkles",
  headline: "What's in your stack?",
  subheadline: "One workspace that connects your systems, runs the routine work, and shows you exactly what needs your judgment.",
  align: "center",
  ctaText: "Get started",
  ctaUrl: "#",
  ctaAction: "url",
  ctaSecondaryText: "",
  ctaSecondaryUrl: "#",
  ctaSecondaryAction: "url",
  mediaVideoUrl: "",
  mediaImageUrl: "",
  mediaImageAlt: "",
  mediaBlend: "auto",
  mediaEdgeFade: true,
  mediaAspect: "16/9",
  showSoundToggle: false,
  logosLabel: "",
  logos: [],
};

export function BlockGlowVideoHero({ props, brand, pageId, variantId, onCtaClick, onFieldChange }: Props) {
  const reduced = useReducedMotion() ?? false;
  const anim = useAnimInitial();
  const pal = resolveGlowPalette(props, brand);
  const isEditor = !!onFieldChange;
  const align = props.align ?? "center";
  const centered = align === "center";

  const field = (key: keyof GlowVideoHeroBlockProps) =>
    onFieldChange
      ? (v: string) => onFieldChange({ ...props, [key]: v as GlowVideoHeroBlockProps[typeof key] })
      : undefined;

  const logos = props.logos ?? [];
  const updateLogo = onFieldChange
    ? (i: number, patch: Partial<SocialProofLogo>) =>
        onFieldChange({ ...props, logos: logos.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) })
    : undefined;

  const modalCfg = pickCtaModalConfig(props);
  const ctaText = props.ctaText || "Get started";

  const rise = (delay: number) => ({
    initial: reduced ? false : anim({ opacity: 0, y: 18 }),
    animate: reduced ? undefined : { opacity: 1, y: 0 },
    transition: { duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] as const },
  });

  return (
    <section
      className="gvh relative overflow-hidden"
      style={{ background: pal.bg, color: pal.text, fontFamily: GLOW_BODY }}
    >
      <style>{`
        .gvh-cta { transition: transform .25s cubic-bezier(.16,1,.3,1), filter .25s ease; }
        @media (hover: hover) { .gvh-cta:hover { transform: translateY(-1px); filter: brightness(1.04); } }
        @media (prefers-reduced-motion: reduce) { .gvh-cta, .gvh-cta:hover { transition: none; transform: none; } }
      `}</style>

      {/* Ambient glow rising from behind the media panel into the page. */}
      <div className="absolute inset-x-0 bottom-0 h-[70%] pointer-events-none" aria-hidden="true">
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(60% 55% at 50% 78%, color-mix(in srgb, ${pal.glow} ${pal.dark ? 26 : 46}%, transparent) 0%, transparent 70%)`,
            filter: "blur(40px)",
          }}
        />
      </div>

      <div className="relative w-full max-w-[1200px] mx-auto px-6 lg:px-10 pt-20 lg:pt-28 pb-14 lg:pb-20">
        <div className={cn("flex flex-col gap-5", centered ? "items-center text-center" : "items-start text-left")}>
          {(props.eyebrow || isEditor) && (
            <motion.p
              {...rise(0)}
              className="inline-flex items-center gap-2 text-sm font-medium"
              style={{ color: pal.muted }}
            >
              <span className="inline-flex items-center justify-center" style={{ color: pal.accent }} aria-hidden="true">
                <IconOrImage value={props.eyebrowIcon} fallback={Sparkles} className="w-4 h-4" />
              </span>
              <InlineText as="span" value={props.eyebrow ?? ""} onUpdate={field("eyebrow")} />
            </motion.p>
          )}

          <motion.h1
            {...rise(0.06)}
            className="font-semibold leading-[1.02] max-w-[16ch]"
            style={{ fontFamily: GLOW_DISPLAY, letterSpacing: DISPLAY_TRACKING, fontSize: "clamp(2.75rem, 6.4vw, 5.25rem)" }}
          >
            <InlineText as="span" value={props.headline ?? ""} onUpdate={field("headline")} multiline />
          </motion.h1>

          {(props.subheadline || isEditor) && (
            <motion.p
              {...rise(0.12)}
              className="text-lg lg:text-xl leading-relaxed max-w-[52ch]"
              style={{ color: pal.muted }}
            >
              <InlineText as="span" value={props.subheadline ?? ""} onUpdate={field("subheadline")} multiline />
            </motion.p>
          )}

          <motion.div {...rise(0.18)} className={cn("flex flex-wrap items-center gap-3 mt-2", centered && "justify-center")}>
            <CtaButton
              ctaAction={props.ctaAction || "url"}
              ctaUrl={props.ctaUrl}
              chilipiperUrl={props.chilipiperUrl}
              videoUrl={props.videoUrl}
              videoPosterUrl={props.videoPosterUrl}
              {...modalCfg}
              onClick={(props.ctaAction || "url") === "url" ? onCtaClick : undefined}
              brand={brand}
              pageId={pageId}
              variantId={variantId}
              source="glow-video-hero-primary"
              className="gvh-cta inline-flex min-h-[46px] items-center justify-center gap-2 rounded-full px-6 py-3 text-[15px] font-semibold"
              style={{ background: pal.cta.bg, color: pal.cta.text, boxShadow: `0 10px 30px -14px color-mix(in srgb, ${pal.cta.bg} 70%, transparent)` }}
            >
              <InlineText as="span" value={ctaText} onUpdate={field("ctaText")} />
            </CtaButton>

            {(props.ctaSecondaryText || isEditor) && (
              <CtaButton
                ctaAction={props.ctaSecondaryAction || "url"}
                ctaUrl={props.ctaSecondaryUrl}
                chilipiperUrl={props.secondaryChilipiperUrl}
                videoUrl={props.secondaryVideoUrl}
                {...modalCfg}
                onClick={(props.ctaSecondaryAction || "url") === "url" ? onCtaClick : undefined}
                brand={brand}
                pageId={pageId}
                variantId={variantId}
                source="glow-video-hero-secondary"
                className="gvh-cta inline-flex min-h-[46px] items-center justify-center gap-2 rounded-full px-5 py-3 text-[15px] font-semibold"
                style={{ color: pal.text, background: "transparent", border: `1px solid ${pal.hairline}` }}
              >
                <InlineText as="span" value={props.ctaSecondaryText || "See a demo"} onUpdate={field("ctaSecondaryText")} />
                <ArrowRight className="w-4 h-4" aria-hidden />
              </CtaButton>
            )}
          </motion.div>
        </div>

        <motion.div
          initial={reduced ? false : anim({ opacity: 0, y: 32 })}
          animate={reduced ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.26, ease: [0.16, 1, 0.3, 1] }}
          className="relative mt-12 lg:mt-16"
        >
          <GlowPanel palette={pal} glowFrom="bottom" intensity={pal.dark ? 0.6 : 1} radius={32} className="w-full">
            <div className="px-3 pt-3 sm:px-6 sm:pt-6 lg:px-10 lg:pt-10">
              <BlendMedia
                videoUrl={props.mediaVideoUrl}
                imageUrl={props.mediaImageUrl}
                imageAlt={props.mediaImageAlt}
                imageFocal={props.mediaImageFocal}
                blend={props.mediaBlend}
                edgeFade={props.mediaEdgeFade !== false}
                aspect={props.mediaAspect ?? "16/9"}
                playMode="inview"
                showSoundToggle={props.showSoundToggle}
                soundToggleLabel={props.soundToggleLabel}
                palette={pal}
                placeholder="board"
                title={props.headline}
                className="rounded-t-2xl"
                onImageUpdate={field("mediaImageUrl")}
                onAltUpdate={field("mediaImageAlt")}
                onFocalUpdate={field("mediaImageFocal")}
              />
            </div>
          </GlowPanel>
        </motion.div>

        {(logos.length > 0 || props.logosLabel || isEditor) && (
          <div className="mt-12 lg:mt-14 flex flex-col items-center gap-6">
            {(props.logosLabel || isEditor) && (
              <p className="text-xs uppercase tracking-[0.22em] font-semibold" style={{ color: pal.muted }}>
                <InlineText as="span" value={props.logosLabel ?? ""} onUpdate={field("logosLabel")} />
              </p>
            )}
            {logos.length > 0 && (
              <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-5" aria-label="Customer logos">
                {logos.map((logo, i) => (
                  <li key={i} className="flex items-center justify-center h-8" style={{ opacity: 0.62 }}>
                    {logo.imageUrl || updateLogo ? (
                      <InlineImage
                        src={logo.imageUrl || ""}
                        alt={logo.name}
                        className={cn("h-7 w-auto max-w-[140px] object-contain", pal.dark ? "invert brightness-200" : "grayscale")}
                        loading="lazy"
                        onUpdate={updateLogo ? (url) => updateLogo(i, { imageUrl: url }) : undefined}
                      />
                    ) : (
                      <span className="text-lg font-semibold tracking-tight" style={{ fontFamily: GLOW_DISPLAY, color: pal.text }}>
                        {logo.name}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
