import { Quote, Sparkles, ArrowRight } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { CaseStudyMetricTriptychBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";

interface Props {
  props: CaseStudyMetricTriptychBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: CaseStudyMetricTriptychBlockProps) => void;
}

export function BlockCaseStudyMetricTriptych({ props, brand, onFieldChange }: Props) {
  const bg = props.bgColor ?? "#fafafa";
  const surface = props.surfaceColor ?? "#ffffff";
  const ink = props.textColor ?? "#0f172a";
  const accent = props.accentColor ?? brand.primaryColor ?? "#4f46e5";
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;
  const muted = pickContrastingColor(undefined, bg, ["#64748b", "#94a3b8"]);
  const border = `${ink}14`;

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
    <section className="w-full py-24 sm:py-32" style={{ backgroundColor: bg }}>
      <div className="container mx-auto px-6 md:px-12 max-w-6xl text-center">
        <div className="flex flex-col items-center justify-center mb-16">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-sm border"
            style={{ backgroundColor: surface, borderColor: border, color: accent }}
          >
            <Sparkles className="w-8 h-8" />
          </div>
          <InlineText
            as="span"
            value={props.company}
            onUpdate={onFieldChange ? (v: string) => update("company", v) : undefined}
            className="text-xl font-bold tracking-tight uppercase"
            style={{ color: ink, fontFamily: DISPLAY }} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 mb-20">
          {metrics.map((metric, i) => (
            <div key={i} className="flex flex-col items-center text-center">
              <InlineText
                as="div"
                value={metric.value}
                onUpdate={onFieldChange ? (v: string) => updateMetric(i, { value: v }) : undefined}
                className="text-5xl md:text-6xl font-extrabold tracking-tighter mb-4"
                style={{ color: accent, fontFamily: DISPLAY }} />
              <InlineText
                as="div"
                value={metric.label}
                onUpdate={onFieldChange ? (v: string) => updateMetric(i, { label: v }) : undefined}
                className="text-lg md:text-xl font-medium max-w-[220px]"
                style={{ color: ink, fontFamily: BODY }}
                multiline />
            </div>
          ))}
        </div>

        <div className="max-w-4xl mx-auto mb-16">
          <Quote className="h-12 w-12 mx-auto mb-8 opacity-20" style={{ color: ink }} />
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
        </div>

        {(props.ctaLabel || onFieldChange) && (
          <div className="pt-10 border-t" style={{ borderColor: border }}>
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
          </div>
        )}
      </div>
    </section>
  );
}
