import type { BrandConfig } from "@/lib/brand-config";
import {
  contrastTextColor,
  isValidHex,
  pickContrastingColor,
  pickCtaButtonColors,
} from "@/lib/brand-config";
import type { GradientGlowFinalCtaBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { CtaButton } from "@/components/CtaButton";
import { pickCtaModalConfig } from "@/lib/cta-modal";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";

/* ----------------------------------------------------------------------------
 * Final CTA — Gradient Glow: a deep-surface finale with two controlled,
 * slow-drifting brand glows (static under prefers-reduced-motion), an
 * oversized display headline, and runtime-contrast pill buttons.
 * -------------------------------------------------------------------------- */

interface Props {
  props: GradientGlowFinalCtaBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: GradientGlowFinalCtaBlockProps) => void;
}

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

export function BlockGradientGlowFinalCta({ props, brand, onFieldChange }: Props) {
  const surface = resolveSectionSurface(props, "#0B1120");
  const base = surface.base;

  const accentPref =
    props.accentColor && isValidHex(props.accentColor) ? props.accentColor : undefined;
  const accentRaw =
    accentPref ?? (isValidHex(brand.accentColor) ? brand.accentColor : brand.primaryColor);
  // Glow hues are decorative — raw brand colors read fine through heavy blur.
  const gradStart = props.gradientStart && isValidHex(props.gradientStart) ? props.gradientStart : accentRaw;
  const gradEnd =
    props.gradientEnd && isValidHex(props.gradientEnd)
      ? props.gradientEnd
      : isValidHex(brand.primaryColor)
        ? brand.primaryColor
        : accentRaw;

  const ink = props.textColor ?? surface.color ?? pickContrastingColor(undefined, base, ["#ffffff", "#0f172a"]);
  const muted = `color-mix(in srgb, ${ink} 70%, transparent)`;
  const accent = pickContrastingColor(accentRaw, base, [brand.primaryColor, ink], 3.0);
  const cta = accentPref
    ? (() => {
        const bg = pickContrastingColor(accentPref, base, [brand.accentColor, brand.primaryColor], 3.0);
        return { bg, text: pickContrastingColor(brand.ctaText, bg, [contrastTextColor(bg)], 4.5) };
      })()
    : pickCtaButtonColors(brand, base);

  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;

  const update = <K extends keyof GradientGlowFinalCtaBlockProps>(key: K, value: GradientGlowFinalCtaBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });

  return (
    <section
      className="ggf-cta relative w-full overflow-hidden px-6 py-28 sm:py-36"
      style={{ background: surface.background, fontFamily: BODY }}
    >
      <style>{`
        @keyframes ggf-drift-a {
          0%, 100% { transform: translate(-50%, 0) scale(1); }
          50% { transform: translate(-44%, -4%) scale(1.08); }
        }
        @keyframes ggf-drift-b {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-6%, -6%) scale(0.94); }
        }
        .ggf-cta .ggf-glow-a { animation: ggf-drift-a 26s ease-in-out infinite; }
        .ggf-cta .ggf-glow-b { animation: ggf-drift-b 32s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .ggf-cta .ggf-glow-a, .ggf-cta .ggf-glow-b { animation: none; }
        }
      `}</style>

      {/* Controlled glows: one above the headline, one low counter-glow. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div
          className="ggf-glow-a absolute left-1/2 top-[-35%] h-[85%] w-[72%] -translate-x-1/2 rounded-full blur-3xl"
          style={{ background: `radial-gradient(closest-side, color-mix(in srgb, ${gradStart} 32%, transparent), transparent 70%)` }}
        />
        <div
          className="ggf-glow-b absolute bottom-[-40%] right-[-10%] h-[80%] w-[60%] rounded-full blur-3xl"
          style={{ background: `radial-gradient(closest-side, color-mix(in srgb, ${gradEnd} 24%, transparent), transparent 70%)` }}
        />
        {/* Vignette keeps copy contrast steady over the glows. */}
        <div
          className="absolute inset-0"
          style={{ background: `radial-gradient(85% 65% at 50% 45%, transparent 0%, color-mix(in srgb, ${base} 65%, transparent) 100%)` }}
        />
      </div>

      <div className="container relative z-10 mx-auto max-w-4xl text-center" style={{ color: ink }}>
        {(props.eyebrow || onFieldChange) && (
          <InlineText
            as="p"
            value={props.eyebrow ?? ""}
            onUpdate={onFieldChange ? (v) => update("eyebrow", v) : undefined}
            className="mb-6 text-[11px] font-bold uppercase tracking-[0.3em]"
            style={{ color: accent }}
          />
        )}
        <InlineText
          as="h2"
          value={props.heading}
          onUpdate={onFieldChange ? (v) => update("heading", v) : undefined}
          className="text-balance font-bold leading-[1.03] tracking-tight"
          style={{ color: ink, fontFamily: DISPLAY, fontSize: "clamp(2.75rem, 7.5vw, 4.75rem)" }}
        />
        {(props.subheading || onFieldChange) && (
          <InlineText
            as="p"
            value={props.subheading ?? ""}
            onUpdate={onFieldChange ? (v) => update("subheading", v) : undefined}
            className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl"
            style={{ color: muted }}
            multiline
          />
        )}
        <div className="mt-11 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {(props.ctaLabel || onFieldChange) && (
            <CtaButton
              {...pickCtaModalConfig(props)}
              ctaAction={props.ctaAction ?? "url"}
              ctaUrl={props.ctaUrl}
              chilipiperUrl={props.chilipiperUrl}
              videoUrl={props.videoUrl}
              videoPosterUrl={props.videoPosterUrl}
              brand={brand}
              source="gradient-glow-final-cta-primary"
              className={`inline-flex w-full items-center justify-center rounded-full text-base font-semibold transition-transform motion-safe:hover:-translate-y-0.5 sm:w-auto sm:text-lg ${FOCUS_RING}`}
              style={{
                backgroundColor: cta.bg,
                color: cta.text,
                fontFamily: BODY,
                outlineColor: accent,
                padding: "1.125rem 2.25rem",
                boxShadow: `0 20px 56px -18px color-mix(in srgb, ${gradStart} 60%, transparent)`,
              }}
            >
              {props.ctaLabel || "Get started"}
            </CtaButton>
          )}
          {(props.ctaSecondaryLabel || onFieldChange) && (
            <CtaButton
              ctaAction="url"
              ctaUrl={props.ctaSecondaryUrl}
              brand={brand}
              source="gradient-glow-final-cta-secondary"
              className={`inline-flex w-full items-center justify-center rounded-full border text-base font-semibold transition-colors sm:w-auto sm:text-lg ${FOCUS_RING}`}
              style={{
                borderColor: `color-mix(in srgb, ${ink} 26%, transparent)`,
                background: `color-mix(in srgb, ${ink} 6%, transparent)`,
                color: ink,
                fontFamily: BODY,
                outlineColor: accent,
                padding: "1.125rem 2.25rem",
              }}
            >
              {props.ctaSecondaryLabel || "Talk to sales"}
            </CtaButton>
          )}
        </div>
      </div>
    </section>
  );
}
