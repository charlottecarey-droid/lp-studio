import { ArrowRight } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { CtaGradientBannerBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";

interface Props {
  props: CtaGradientBannerBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: CtaGradientBannerBlockProps) => void;
}

export function BlockCtaGradientBanner({ props, brand, onFieldChange }: Props) {
  const surface = resolveSectionSurface(props, "#ffffff");
  const accent = props.accentColor ?? brand.primaryColor ?? "#4f46e5";
  const onAccent = props.textColor ?? pickContrastingColor(undefined, accent, ["#ffffff", "#0f172a"]);
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;

  const update = <K extends keyof CtaGradientBannerBlockProps>(key: K, value: CtaGradientBannerBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });

  return (
    <section className="w-full px-6 py-24 sm:py-32" style={{ background: surface.background }}>
      <div className="container mx-auto max-w-5xl">
        <div
          className="relative overflow-hidden rounded-[2.5rem] p-12 text-center shadow-2xl md:p-24"
          style={{ background: `linear-gradient(135deg, ${accent}, ${accent}dd)`, color: onAccent }}
        >
          <div className="absolute inset-0 bg-black/5 mix-blend-overlay" />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full opacity-20 blur-3xl"
            style={{ background: `radial-gradient(circle, ${onAccent}, transparent 70%)` }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-28 -left-16 h-80 w-80 rounded-full opacity-10 blur-3xl"
            style={{ background: `radial-gradient(circle, ${onAccent}, transparent 70%)` }}
          />
          <div className="relative z-10 flex flex-col items-center">
            <InlineText
              as="h2"
              value={props.heading}
              onUpdate={onFieldChange ? (v) => update("heading", v) : undefined}
              className="mb-6 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight md:text-5xl lg:text-6xl"
              style={{ fontFamily: DISPLAY }} />
            {(props.subheading || onFieldChange) && (
              <InlineText
                as="p"
                value={props.subheading ?? ""}
                onUpdate={onFieldChange ? (v) => update("subheading", v) : undefined}
                className="mb-12 max-w-2xl text-lg leading-relaxed opacity-90 md:text-xl"
                style={{ fontFamily: BODY }}
                multiline />
            )}
            <div className="flex flex-wrap justify-center gap-3">
              {(props.ctaPrimaryLabel || onFieldChange) && (
                <CtaButton
                  ctaAction="url"
                  ctaUrl={props.ctaPrimaryUrl}
                  brand={brand}
                  source="cta-gradient-banner-primary"
                  className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-base font-semibold shadow-sm"
                  style={{ backgroundColor: onAccent, color: accent, fontFamily: BODY }}
                >
                  {props.ctaPrimaryLabel || "Start for free"}
                  <ArrowRight className="h-4 w-4" />
                </CtaButton>
              )}
              {(props.ctaSecondaryLabel || onFieldChange) && (
                <CtaButton
                  ctaAction="url"
                  ctaUrl={props.ctaSecondaryUrl}
                  brand={brand}
                  source="cta-gradient-banner-secondary"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border px-6 py-3.5 text-base font-semibold"
                  style={{ borderColor: `${onAccent}33`, color: onAccent, fontFamily: BODY }}
                >
                  {props.ctaSecondaryLabel || "Talk to sales"}
                </CtaButton>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
