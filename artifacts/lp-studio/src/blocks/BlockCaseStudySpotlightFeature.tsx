import { ArrowRight, BarChart3, Zap } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { CaseStudySpotlightFeatureBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";
import { Reveal, RevealStagger, RevealItem, AccentGlow } from "@/lib/premium-toolkit";
import { StatCounter } from "./StatCounter";

interface Props {
  props: CaseStudySpotlightFeatureBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: CaseStudySpotlightFeatureBlockProps) => void;
}

export function BlockCaseStudySpotlightFeature({ props, brand, onFieldChange }: Props) {
  const surface = resolveSectionSurface(props, "#ffffff");
  const cardSurface = props.surfaceColor ?? "#ffffff";
  const ink = props.textColor ?? surface.color ?? "#0f172a";
  const accent = props.accentColor ?? brand.primaryColor ?? "#4f46e5";
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;
  const muted = pickContrastingColor(undefined, surface.base, ["#64748b", "#94a3b8"]);
  const surfaceMuted = pickContrastingColor(undefined, cardSurface, ["#64748b", "#94a3b8"]);
  const border = `${ink}14`;
  const animate = !onFieldChange;

  const update = <K extends keyof CaseStudySpotlightFeatureBlockProps>(
    key: K,
    value: CaseStudySpotlightFeatureBlockProps[K],
  ) => onFieldChange?.({ ...props, [key]: value });

  const sections: { label: string; key: "challenge" | "solution" | "result"; value: string }[] = [
    { label: "The Challenge", key: "challenge", value: props.challenge },
    { label: "The Solution", key: "solution", value: props.solution },
    { label: "The Result", key: "result", value: props.result },
  ];

  return (
    <section className="relative w-full overflow-hidden py-24 sm:py-32" style={{ background: surface.background }}>
      <AccentGlow color={accent} isDark={surface.isDark} />
      <div className="relative z-10 container mx-auto px-6 md:px-12 max-w-7xl">
        {(props.eyebrow || onFieldChange) && (
          <Reveal disabled={!animate} className="mb-12">
            <InlineText
              as="span"
              value={props.eyebrow ?? ""}
              onUpdate={onFieldChange ? (v: string) => update("eyebrow", v) : undefined}
              className="text-sm font-bold uppercase tracking-wider block"
              style={{ color: accent, fontFamily: BODY }} />
          </Reveal>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Content Side */}
          <Reveal disabled={!animate} className="flex flex-col">
            <div className="flex items-center gap-3 mb-8">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${accent}1a`, color: accent, boxShadow: `inset 0 0 0 1px ${accent}26` }}
              >
                <Zap className="w-6 h-6" />
              </div>
              <InlineText
                as="span"
                value={props.company}
                onUpdate={onFieldChange ? (v: string) => update("company", v) : undefined}
                className="text-xl font-bold"
                style={{ color: ink, fontFamily: DISPLAY }} />
            </div>

            <InlineText
              as="h2"
              value={props.headline}
              onUpdate={onFieldChange ? (v: string) => update("headline", v) : undefined}
              className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-8 leading-tight"
              style={{ color: ink, fontFamily: DISPLAY }}
              multiline />

            <RevealStagger disabled={!animate} className="space-y-6 mb-10 text-lg leading-relaxed">
              {sections.map((s) => (
                <RevealItem key={s.key} disabled={!animate} className="relative pl-4">
                  <span
                    aria-hidden
                    className="absolute left-0 top-1 bottom-1 w-1 rounded-full"
                    style={{ background: `linear-gradient(${accent}, ${accent}33)` }}
                  />
                  <span className="block mb-1 font-semibold uppercase tracking-wider text-xs" style={{ color: accent, fontFamily: BODY }}>{s.label}</span>
                  <InlineText
                    as="p"
                    value={s.value}
                    onUpdate={onFieldChange ? (v: string) => update(s.key, v) : undefined}
                    style={{ color: muted, fontFamily: BODY }}
                    multiline />
                </RevealItem>
              ))}
            </RevealStagger>

            <div
              className="p-6 rounded-2xl mb-10 border"
              style={{ backgroundColor: cardSurface, borderColor: border, boxShadow: `0 16px 40px -20px ${accent}55` }}
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${accent}1a`, color: accent }}
                >
                  <BarChart3 className="w-6 h-6" />
                </div>
                <div>
                  <div
                    className="text-3xl font-bold tracking-tight mb-1"
                    style={{ color: ink, fontFamily: DISPLAY }}
                  >
                    {onFieldChange ? (
                      <InlineText
                        as="span"
                        value={props.metricValue}
                        onUpdate={(v: string) => update("metricValue", v)}
                        style={{ fontFamily: DISPLAY }} />
                    ) : (
                      <StatCounter value={props.metricValue} style={{ fontFamily: DISPLAY }} />
                    )}
                  </div>
                  <InlineText
                    as="div"
                    value={props.metricLabel}
                    onUpdate={onFieldChange ? (v: string) => update("metricLabel", v) : undefined}
                    className="text-sm font-medium"
                    style={{ color: surfaceMuted, fontFamily: BODY }} />
                </div>
              </div>
            </div>

            {(props.ctaLabel || onFieldChange) && (
              <CtaButton
                ctaAction="url"
                ctaUrl={props.ctaUrl}
                brand={brand}
                source="case-study-spotlight-feature-cta"
                className="inline-flex items-center gap-2 font-bold self-start"
                style={{ color: accent, fontFamily: BODY }}
              >
                {props.ctaLabel || "Read the case study"}
                <ArrowRight className="w-4 h-4" />
              </CtaButton>
            )}
          </Reveal>

          {/* Image Side */}
          <Reveal disabled={!animate} delay={0.1} className="relative">
            <div
              className="absolute -inset-4 rounded-3xl opacity-50 blur-2xl transform rotate-3"
              style={{ backgroundColor: accent }}
            />
            <div
              className="group relative aspect-[4/3] rounded-2xl overflow-hidden border shadow-xl"
              style={{ borderColor: border, backgroundColor: cardSurface }}
            >
              <InlineImage
                src={props.imageUrl}
                alt={props.imageAlt || `${props.company} feature photo`}
                onUpdate={onFieldChange ? (src: string) => update("imageUrl", src) : undefined}
                onAltUpdate={onFieldChange ? (alt: string) => update("imageAlt", alt) : undefined}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                wrapperClassName="block w-full h-full"
              />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
