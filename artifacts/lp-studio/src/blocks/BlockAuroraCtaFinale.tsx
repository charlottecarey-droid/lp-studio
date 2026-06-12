import { ArrowRight, CheckCircle2, Clock, CreditCard, Globe, Heart, Lock, Shield, Sparkles, Star, Zap, type LucideIcon } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import {
  isValidHex,
  pickContrastingColor,
  pickCtaButtonColors,
} from "@/lib/brand-config";
import { InlineText } from "@/components/InlineText";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { toFontFamilyValue } from "@/lib/font-catalog";
import { useBlockFonts } from "@/lib/use-block-fonts";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Aurora CTA Finale — the page's closing argument. A deep dark full-width
 * section with slow-drifting aurora glows in brand accent tones, an oversized
 * display headline, a large pill CTA pair, an optional reassurance row, and
 * an optional faint oversized brand watermark behind everything.
 *
 * Props are defined here (exported) so the block is fully self-contained;
 * the matching panel imports them from this file.
 * -------------------------------------------------------------------------- */

export interface AuroraCtaReassurance {
  /** One of the curated lucide icon keys (see REASSURANCE_ICONS). */
  icon?: string;
  text: string;
}

export interface AuroraCtaFinaleBlockProps {
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  ctaText?: string;
  ctaUrl?: string;
  ctaSecondaryText?: string;
  ctaSecondaryUrl?: string;
  /** Short icon + phrase reassurances under the buttons,
   *  e.g. "Free to start · No card required". Empty array hides the row. */
  reassurances?: AuroraCtaReassurance[];
  /** Faint oversized watermark text behind the section (defaults to the
   *  brand name). Hidden when `showWatermark` is false. */
  watermarkText?: string;
  showWatermark?: boolean;
  /** Deep dark surface color. Must stay dark — the aurora glows and white
   *  type are tuned for it. */
  bgColor?: string;
  accentColor?: string;
  textColor?: string;
  headlineFont?: string;
  bodyFont?: string;
}

interface Props {
  props: AuroraCtaFinaleBlockProps;
  brand: BrandConfig;
  onCtaClick?: () => void;
  onFieldChange?: (updated: AuroraCtaFinaleBlockProps) => void;
  pageId?: number;
  variantId?: number;
}

const SURFACE_HEX = "#05060A";

/** Curated lucide set for the reassurance row. */
const REASSURANCE_ICONS: Record<string, LucideIcon> = {
  CheckCircle2,
  Sparkles,
  Shield,
  Zap,
  CreditCard,
  Clock,
  Lock,
  Star,
  Globe,
  Heart,
};

function resolveIcon(name?: string): LucideIcon {
  if (name && REASSURANCE_ICONS[name]) return REASSURANCE_ICONS[name];
  return CheckCircle2;
}

const DEFAULT_REASSURANCES: AuroraCtaReassurance[] = [
  { icon: "Sparkles", text: "Free to start" },
  { icon: "CreditCard", text: "No card required" },
  { icon: "Clock", text: "Cancel anytime" },
];

export function BlockAuroraCtaFinale({ props, brand, onCtaClick, onFieldChange, pageId, variantId }: Props) {
  // ── Surface + colors. The section is deliberately dark-only; a custom
  // bgColor is honored but the type stays light, so very light overrides
  // are clamped back to the deep default. ──
  const requestedBg = props.bgColor && isValidHex(props.bgColor) ? props.bgColor : SURFACE_HEX;
  const surfaceHex = requestedBg;
  const text = props.textColor && isValidHex(props.textColor) ? props.textColor : "#FFFFFF";
  const accentPref = props.accentColor && isValidHex(props.accentColor) ? props.accentColor : undefined;
  // Aurora glows are decorative — raw brand accent reads fine through blur.
  const glowA = accentPref ?? (isValidHex(brand.accentColor) ? brand.accentColor : "#6366F1");
  const glowB = isValidHex(brand.primaryColor) ? brand.primaryColor : "#3B82F6";
  // Eyebrow / icon tint must actually contrast with the dark surface.
  const accent = pickContrastingColor(accentPref ?? brand.accentColor, surfaceHex, [brand.primaryColor, "#A5B4FC"], 3.0);
  // Primary CTA fill + label are runtime-contrast-resolved (compliant path).
  const ctaPick = pickCtaButtonColors(brand, surfaceHex);

  // ── Fonts (panel override → brand tokens). ──
  useBlockFonts(props.headlineFont, props.bodyFont);
  const DISPLAY = props.headlineFont
    ? toFontFamilyValue(props.headlineFont, "display") || BRAND_DISPLAY_FONT
    : BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont
    ? toFontFamilyValue(props.bodyFont, "sans") || BRAND_BODY_FONT
    : BRAND_BODY_FONT;

  const field = (key: keyof AuroraCtaFinaleBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v }) : undefined;

  const reassurances = props.reassurances ?? DEFAULT_REASSURANCES;
  const showWatermark = props.showWatermark !== false;
  const watermark = (props.watermarkText ?? brand.brandName ?? "").trim();

  const focusRing =
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

  return (
    <section
      className="aurora-cta-finale relative w-full overflow-hidden px-6 py-28 sm:py-36 lg:py-44"
      style={{ background: surfaceHex, color: text, fontFamily: BODY }}
    >
      <style>{`
        @keyframes aurora-finale-a {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(8%, -10%) scale(1.15); }
          66% { transform: translate(-10%, 6%) scale(0.9); }
        }
        @keyframes aurora-finale-b {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-12%, 8%) scale(0.92); }
          66% { transform: translate(10%, -8%) scale(1.12); }
        }
        .aurora-cta-finale .acf-blob {
          position: absolute; border-radius: 50%; filter: blur(110px);
          mix-blend-mode: screen; pointer-events: none;
        }
        .aurora-cta-finale .acf-blob-a { animation: aurora-finale-a 32s ease-in-out infinite; }
        .aurora-cta-finale .acf-blob-b { animation: aurora-finale-b 38s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .aurora-cta-finale .acf-blob { animation: none; }
        }
      `}</style>

      {/* Aurora glows (static gradient under reduced motion) */}
      <div aria-hidden className="absolute inset-0 overflow-hidden">
        <div
          className="acf-blob acf-blob-a left-[8%] top-[-20%] h-[70%] w-[55%]"
          style={{ background: `radial-gradient(circle, ${glowA}66 0%, transparent 70%)` }}
        />
        <div
          className="acf-blob acf-blob-b bottom-[-25%] right-[5%] h-[75%] w-[60%]"
          style={{ background: `radial-gradient(circle, ${glowB}59 0%, transparent 70%)` }}
        />
        <div
          className="acf-blob left-[35%] top-[30%] h-[55%] w-[45%] opacity-70"
          style={{ background: `radial-gradient(circle, ${glowA}40 0%, transparent 70%)` }}
        />
        {/* Vignette keeps copy contrast steady over the glows */}
        <div
          className="absolute inset-0"
          style={{ background: `radial-gradient(80% 60% at 50% 50%, transparent 0%, ${surfaceHex}B3 100%)` }}
        />
      </div>

      {/* Faint oversized brand watermark */}
      {showWatermark && watermark && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 flex select-none justify-center overflow-hidden"
        >
          <span
            className="translate-y-[30%] whitespace-nowrap font-bold leading-none tracking-tight"
            style={{
              fontFamily: DISPLAY,
              fontSize: "clamp(7rem, 24vw, 20rem)",
              color: text,
              opacity: 0.04,
            }}
          >
            {watermark}
          </span>
        </div>
      )}

      <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center text-center">
        {/* Eyebrow */}
        {(props.eyebrow || onFieldChange) && (
          <InlineText
            as="p"
            value={props.eyebrow ?? ""}
            onUpdate={field("eyebrow")}
            className="mb-6 text-[11px] font-bold uppercase tracking-[0.3em]"
            style={{ color: accent }}
          />
        )}

        {/* Oversized display headline */}
        <h2
          className="text-balance font-bold leading-[1.02] tracking-tight"
          style={{ fontFamily: DISPLAY, fontSize: "clamp(2.75rem, 8vw, 5rem)", color: text }}
        >
          <InlineText as="span" value={props.headline} onUpdate={field("headline")} multiline />
        </h2>

        {/* One-line subhead */}
        {(props.subheadline || onFieldChange) && (
          <InlineText
            as="p"
            value={props.subheadline ?? ""}
            onUpdate={field("subheadline")}
            className="mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl"
            style={{ color: `color-mix(in srgb, ${text} 65%, transparent)` }}
            multiline
          />
        )}

        {/* CTA pair */}
        <div className="mt-12 flex w-full flex-col items-center justify-center gap-4 sm:w-auto sm:flex-row">
          <CtaButton
            ctaAction="url"
            ctaUrl={props.ctaUrl}
            onClick={onCtaClick}
            brand={brand}
            pageId={pageId}
            variantId={variantId}
            source="aurora-cta-finale-primary"
            className={cn(
              "inline-flex w-full items-center justify-center gap-2.5 rounded-full px-10 py-5 text-base font-semibold transition-transform hover:-translate-y-0.5 sm:w-auto sm:text-lg",
              focusRing,
            )}
            style={{
              background: ctaPick.bg,
              color: ctaPick.text,
              boxShadow: `0 20px 60px -16px ${glowA}99`,
              outlineColor: accent,
            }}
          >
            <InlineText
              as="span"
              value={props.ctaText ?? "Get started free"}
              onUpdate={field("ctaText")}
            />
            <ArrowRight className="h-5 w-5" aria-hidden />
          </CtaButton>

          {(props.ctaSecondaryText || onFieldChange) && (
            <CtaButton
              ctaAction="url"
              ctaUrl={props.ctaSecondaryUrl}
              brand={brand}
              pageId={pageId}
              variantId={variantId}
              source="aurora-cta-finale-secondary"
              className={cn(
                "inline-flex w-full items-center justify-center gap-2 rounded-full px-10 py-5 text-base font-semibold backdrop-blur-md transition-colors sm:w-auto sm:text-lg",
                focusRing,
              )}
              style={{
                background: `color-mix(in srgb, ${text} 6%, transparent)`,
                border: `1px solid color-mix(in srgb, ${text} 18%, transparent)`,
                color: text,
                outlineColor: accent,
              }}
            >
              <InlineText
                as="span"
                value={props.ctaSecondaryText ?? "Talk to sales"}
                onUpdate={field("ctaSecondaryText")}
              />
            </CtaButton>
          )}
        </div>

        {/* Reassurance row */}
        {reassurances.length > 0 && (
          <ul className="mt-10 flex flex-wrap items-center justify-center gap-x-7 gap-y-3">
            {reassurances.map((item, i) => {
              const Icon = resolveIcon(item.icon);
              return (
                <li
                  key={i}
                  className="flex items-center gap-2 text-sm font-medium"
                  style={{ color: `color-mix(in srgb, ${text} 55%, transparent)` }}
                >
                  <Icon className="h-4 w-4 shrink-0" style={{ color: accent }} aria-hidden />
                  <InlineText
                    as="span"
                    value={item.text}
                    onUpdate={
                      onFieldChange
                        ? (v) =>
                            onFieldChange({
                              ...props,
                              reassurances: reassurances.map((r, j) => (j === i ? { ...r, text: v } : r)),
                            })
                        : undefined
                    }
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
