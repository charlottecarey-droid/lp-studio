import { Quote, Sparkles, ArrowRight } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { CaseStudyMetricTriptychBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";
import { Reveal, RevealStagger, RevealItem, AccentGlow } from "@/lib/premium-toolkit";
import { StatCounter } from "./StatCounter";

interface Props {
  props: CaseStudyMetricTriptychBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: CaseStudyMetricTriptychBlockProps) => void;
}

export function BlockCaseStudyMetricTriptych({ props, brand, onFieldChange }: Props) {
  const surface = resolveSectionSurface(props, "#fafafa");
  const cardSurface = props.surfaceColor ?? "#ffffff";
  const ink = props.textColor ?? surface.color ?? "#0f172a";
  const accent = props.accentColor ?? brand.primaryColor ?? "#4f46e5";
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;
  const muted = pickContrastingColor(undefined, surface.base, ["#64748b", "#94a3b8"]);
  const border = `${ink}14`;
  const animate = !onFieldChange;

  const metrics = props.metrics ?? [];

  const update = <K extends keyof CaseStudyMetricTriptychBlockProps>(
    key: K,
    value: CaseStudyMetricTriptychBlockProps[K],
  ) => onFieldChange?.({ ...props, [key]: value });

  const updateMetric = (
    i: number,
    patch: Partial<CaseStudyMetricTriptychBlockProps["metrics"][number]>,
  ) => {
    if (!onFieldChange) return;
    const next = metrics.map((metric, idx) => (idx === i ? { ...metric, ...patch } : metric));
    onFieldChange({ ...props, metrics: next });
  };

  return (
    <section className="relative w-full overflow-hidden py-24 sm:py-32" style={{ background: surface.background }}>
      <AccentGlow color={accent} isDark={surface.isDark} />
      <div className="relative z-10 container mx-auto px-6 md:px-12 max-w-6xl text-center">
        <Reveal disabled={!animate} className="flex flex-col items-center justify-center mb-16">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-sm border"
            style={{ backgroundColor: cardSurface, borderColor: border, color: accent, boxShadow: `0 12px 30px -12px ${accent}55` }}
          >
            <Sparkles className="w-8 h-8" />
          </div>
          <InlineText
            as="span"
            value={props.company}
            onUpdate={onFieldChange ? (v: string) => update("company", v) : undefined}
            className="text-xl font-bold tracking-tight uppercase"
            style={{ color: ink, fontFamily: DISPLAY }} />
        </Reveal>

        <RevealStagger disabled={!animate} className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 mb-20">
          {metrics.map((metric, i) => (
            <RevealItem key={i} disabled={!animate} className="group flex flex-col items-center text-center">
              <div
                className="text-5xl md:text-6xl font-extrabold tracking-tighter mb-4"
                style={{ color: accent, fontFamily: DISPLAY }}
              >
                {onFieldChange ? (
                  <InlineText
                    as="span"
                    value={metric.value}
                    onUpdate={(v: string) => updateMetric(i, { value: v })}
                    style={{ fontFamily: DISPLAY }} />
                ) : (
                  <StatCounter value={metric.value} style={{ fontFamily: DISPLAY }} />
                )}
              </div>
              <div
                aria-hidden
                className="h-0.5 w-10 rounded-full mb-4 mx-auto transition-all duration-300 group-hover:w-16"
                style={{ background: `linear-gradient(90deg, ${accent}, ${accent}33)` }}
              />
              <InlineText
                as="div"
                value={metric.label}
                onUpdate={onFieldChange ? (v: string) => updateMetric(i, { label: v }) : undefined}
                className="text-lg md:text-xl font-medium max-w-[220px]"
                style={{ color: ink, fontFamily: BODY }}
                multiline />
            </RevealItem>
          ))}
        </RevealStagger>

        <Reveal disabled={!animate} className="relative max-w-4xl mx-auto mb-16">
          <Quote className="h-12 w-12 mx-auto mb-8 opacity-20" style={{ color: accent }} />
          <InlineText
            as="h3"
            value={props.quote}
            onUpdate={onFieldChange ? (v: string) => update("quote", v) : undefined}
            className="text-2xl md:text-3xl font-medium leading-relaxed tracking-tight mb-8"
            style={{ color: ink, fontFamily: DISPLAY }}
            multiline />
          <div className="flex flex-col items-center justify-center">
            <InlineText
              as="span"
              value={props.author}
              onUpdate={onFieldChange ? (v: string) => update("author", v) : undefined}
              className="font-bold text-lg mb-1"
              style={{ color: ink, fontFamily: BODY }} />
            <InlineText
              as="span"
              value={props.role}
              onUpdate={onFieldChange ? (v: string) => update("role", v) : undefined}
              className="font-medium"
              style={{ color: muted, fontFamily: BODY }} />
          </div>
        </Reveal>

        {(props.ctaLabel || onFieldChange) && (
          <Reveal disabled={!animate} className="pt-10 border-t" style={{ borderColor: border }}>
            <CtaButton
              ctaAction="url"
              ctaUrl={props.ctaUrl}
              brand={brand}
              source="case-study-metric-triptych-cta"
              className="inline-flex items-center justify-center gap-2 font-bold"
              style={{ color: accent, fontFamily: BODY }}
            >
              {props.ctaLabel || "View full story"}
              <ArrowRight className="w-4 h-4" />
            </CtaButton>
          </Reveal>
        )}
      </div>
    </section>
  );
}
