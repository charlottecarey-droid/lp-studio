import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { GradientGlowFinalCtaBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { CtaButton } from "@/components/CtaButton";
import { pickCtaModalConfig } from "@/lib/cta-modal";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";

interface Props {
  props: GradientGlowFinalCtaBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: GradientGlowFinalCtaBlockProps) => void;
}

export function BlockGradientGlowFinalCta({ props, brand, onFieldChange }: Props) {
  const accent = props.accentColor ?? brand.primaryColor ?? "#4f46e5";
  const gradStart = props.gradientStart ?? accent;
  const gradEnd = props.gradientEnd ?? brand.primaryColor ?? "#0F172A";
  const surface = resolveSectionSurface(props, "#0B1120");
  const ink = props.textColor ?? surface.color ?? "#FFFFFF";
  const muted = `${ink}CC`;
  const onAccent = pickContrastingColor("#FFFFFF", accent, ["#0F172A", "#FFFFFF"]);
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;

  const update = <K extends keyof GradientGlowFinalCtaBlockProps>(key: K, value: GradientGlowFinalCtaBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });

  return (
    <section className="relative w-full overflow-hidden px-6 py-24 sm:py-32" style={{ background: surface.background, fontFamily: BODY }}>
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[120%] w-[120%] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-60 blur-3xl"
        style={{ background: `radial-gradient(closest-side, ${gradStart}, ${gradEnd}00)` }}
      />
      <div
        className="pointer-events-none absolute bottom-0 right-0 h-[80%] w-[80%] translate-x-1/3 translate-y-1/3 rounded-full opacity-40 blur-3xl"
        style={{ background: `radial-gradient(closest-side, ${gradEnd}, ${gradEnd}00)` }}
      />
      <div className="container relative mx-auto max-w-3xl text-center" style={{ color: ink }}>
        {(props.eyebrow || onFieldChange) && (
          <InlineText as="p" value={props.eyebrow ?? ""} onUpdate={onFieldChange ? (v) => update("eyebrow", v) : undefined} className="mb-4 text-xs font-bold uppercase tracking-[0.2em]" style={{ color: ink, opacity: 0.85 }} />
        )}
        <InlineText as="h2" value={props.heading} onUpdate={onFieldChange ? (v) => update("heading", v) : undefined} className="text-4xl font-extrabold leading-tight tracking-tight md:text-5xl lg:text-6xl" style={{ color: ink, fontFamily: DISPLAY }} />
        {(props.subheading || onFieldChange) && (
          <InlineText as="p" value={props.subheading ?? ""} onUpdate={onFieldChange ? (v) => update("subheading", v) : undefined} className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed md:text-xl" style={{ color: muted }} multiline />
        )}
        <div className="mt-10 flex flex-wrap justify-center gap-3">
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
              className="inline-flex items-center justify-center rounded-xl px-8 py-4 text-base font-semibold shadow-lg"
              style={{ backgroundColor: accent, color: onAccent, fontFamily: BODY }}
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
              className="inline-flex items-center justify-center rounded-xl border px-8 py-4 text-base font-semibold"
              style={{ borderColor: `${ink}66`, color: ink, fontFamily: BODY }}
            >
              {props.ctaSecondaryLabel || "Talk to sales"}
            </CtaButton>
          )}
        </div>
      </div>
    </section>
  );
}
