import { ArrowRight } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import type { CtaModalConfig } from "@/lib/block-types/common";
import type { HeroCtaActionMode } from "@/lib/block-types/generic-blocks";
import { pickCtaModalConfig } from "@/lib/cta-modal";
import { InlineText } from "@/components/InlineText";
import { CtaButton } from "@/components/CtaButton";
import { GLOW_BODY, GLOW_DISPLAY, DISPLAY_TRACKING, resolveGlowPalette } from "@/lib/glow-media";

/* ----------------------------------------------------------------------------
 * Glow Final CTA — type "glow-final-cta"
 *
 * "Capacity returned. Spend it your way." — the family's closing block: a
 * centered two-line display headline, one-line subheadline, and a pill CTA
 * pair, with the accent glow rising softly from the bottom edge into the page
 * surface. Light by default (a quiet close, not a dark slab). No internal
 * scroll-linked motion, so it stays eligible for the viewer reveal.
 * -------------------------------------------------------------------------- */

export interface GlowFinalCtaBlockProps extends CtaModalConfig {
  headline?: string;
  subheadline?: string;
  ctaText?: string;
  ctaUrl?: string;
  ctaAction?: HeroCtaActionMode;
  chilipiperUrl?: string;
  videoUrl?: string;
  videoPosterUrl?: string;
  ctaButtonColor?: string;
  ctaButtonTextColor?: string;
  ctaSecondaryText?: string;
  ctaSecondaryUrl?: string;
  ctaSecondaryAction?: HeroCtaActionMode;
  secondaryChilipiperUrl?: string;
  secondaryVideoUrl?: string;
  /** Small reassurance line under the buttons. */
  footnote?: string;
  showGlow?: boolean;
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
  glowColor?: string;
}

interface Props {
  props: GlowFinalCtaBlockProps;
  brand: BrandConfig;
  pageId?: number;
  variantId?: number;
  onCtaClick?: () => void;
  onFieldChange?: (updated: GlowFinalCtaBlockProps) => void;
}

export const GLOW_FINAL_CTA_DEFAULT_PROPS: GlowFinalCtaBlockProps = {
  headline: "Capacity returned. Spend it your way.",
  subheadline: "",
  ctaText: "Get started",
  ctaUrl: "#",
  ctaAction: "url",
  ctaSecondaryText: "",
  ctaSecondaryUrl: "#",
  ctaSecondaryAction: "url",
  footnote: "",
  showGlow: true,
};

export function BlockGlowFinalCta({ props, brand, pageId, variantId, onCtaClick, onFieldChange }: Props) {
  const pal = resolveGlowPalette(props, brand);
  const isEditor = !!onFieldChange;
  const modalCfg = pickCtaModalConfig(props);

  const field = (key: keyof GlowFinalCtaBlockProps) =>
    onFieldChange
      ? (v: string) => onFieldChange({ ...props, [key]: v as GlowFinalCtaBlockProps[typeof key] })
      : undefined;

  return (
    <section className="gfc relative overflow-hidden" style={{ background: pal.bg, color: pal.text, fontFamily: GLOW_BODY }}>
      <style>{`
        .gfc-cta { transition: transform .25s cubic-bezier(.16,1,.3,1), filter .25s ease; }
        @media (hover: hover) { .gfc-cta:hover { transform: translateY(-1px); filter: brightness(1.04); } }
        @media (prefers-reduced-motion: reduce) { .gfc-cta, .gfc-cta:hover { transition: none; transform: none; } }
      `}</style>

      {props.showGlow !== false && (
        <div className="absolute inset-x-0 bottom-0 h-[62%] pointer-events-none" aria-hidden="true">
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(70% 80% at 50% 118%, color-mix(in srgb, ${pal.glow} ${pal.dark ? 34 : 62}%, transparent) 0%, transparent 70%)`,
            }}
          />
        </div>
      )}

      <div className="relative w-full max-w-[1200px] mx-auto px-6 lg:px-10 py-24 lg:py-36 flex flex-col items-center text-center gap-5">
        <h2
          className="font-semibold leading-[1.04] max-w-[18ch]"
          style={{ fontFamily: GLOW_DISPLAY, letterSpacing: DISPLAY_TRACKING, fontSize: "clamp(2.4rem, 5.4vw, 4.4rem)" }}
        >
          <InlineText as="span" value={props.headline ?? ""} onUpdate={field("headline")} multiline />
        </h2>

        {(props.subheadline || isEditor) && (
          <p className="text-lg leading-relaxed max-w-[50ch]" style={{ color: pal.muted }}>
            <InlineText as="span" value={props.subheadline ?? ""} onUpdate={field("subheadline")} multiline />
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
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
            source="glow-final-cta-primary"
            className="gfc-cta inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full px-7 py-3 text-[15px] font-semibold"
            style={{ background: pal.cta.bg, color: pal.cta.text, boxShadow: `0 12px 34px -14px color-mix(in srgb, ${pal.cta.bg} 70%, transparent)` }}
          >
            <InlineText as="span" value={props.ctaText || "Get started"} onUpdate={field("ctaText")} />
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
              source="glow-final-cta-secondary"
              className="gfc-cta inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full px-6 py-3 text-[15px] font-semibold"
              style={{ color: pal.text, background: "transparent", border: `1px solid ${pal.hairline}` }}
            >
              <InlineText as="span" value={props.ctaSecondaryText || "Talk to us"} onUpdate={field("ctaSecondaryText")} />
              <ArrowRight className="w-4 h-4" aria-hidden />
            </CtaButton>
          )}
        </div>

        {(props.footnote || isEditor) && (
          <p className="text-xs mt-1" style={{ color: pal.muted }}>
            <InlineText as="span" value={props.footnote ?? ""} onUpdate={field("footnote")} />
          </p>
        )}
      </div>
    </section>
  );
}
