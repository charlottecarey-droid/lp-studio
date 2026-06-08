import { ArrowRight } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { CaseStudyLogoResultsRowBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";
import { Reveal, RevealStagger, RevealItem, AccentGlow } from "@/lib/premium-toolkit";
import { StatCounter } from "./StatCounter";

interface Props {
  props: CaseStudyLogoResultsRowBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: CaseStudyLogoResultsRowBlockProps) => void;
}

export function BlockCaseStudyLogoResultsRow({ props, brand, onFieldChange }: Props) {
  const surface = resolveSectionSurface(props, "#ffffff");
  const ink = props.textColor ?? surface.color ?? "#0f172a";
  const accent = props.accentColor ?? brand.primaryColor ?? "#4f46e5";
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;
  const muted = pickContrastingColor(undefined, surface.base, ["#64748b", "#94a3b8"]);
  const onAccent = pickContrastingColor(undefined, accent, ["#ffffff", "#0f172a"]);
  const border = `${ink}14`;
  const animate = !onFieldChange;

  const results = props.results ?? [];
  const isLogo = props.displayMode === "logo";

  const update = <K extends keyof CaseStudyLogoResultsRowBlockProps>(
    key: K,
    value: CaseStudyLogoResultsRowBlockProps[K],
  ) => onFieldChange?.({ ...props, [key]: value });

  const updateResult = (
    i: number,
    patch: Partial<CaseStudyLogoResultsRowBlockProps["results"][number]>,
  ) => {
    if (!onFieldChange) return;
    const next = results.map((item, idx) => (idx === i ? { ...item, ...patch } : item));
    onFieldChange({ ...props, results: next });
  };

  return (
    <section className="relative w-full overflow-hidden py-16 sm:py-24 border-y" style={{ background: surface.background, borderColor: border }}>
      <AccentGlow color={accent} isDark={surface.isDark} />
      <div className="relative z-10 container mx-auto px-6 md:px-12 max-w-7xl">
        {(props.heading || onFieldChange) && (
          <Reveal disabled={!animate}>
            <InlineText
              as="h3"
              value={props.heading ?? ""}
              onUpdate={onFieldChange ? (v: string) => update("heading", v) : undefined}
              className="text-center text-sm font-bold uppercase tracking-[0.2em] mb-16"
              style={{ color: muted, fontFamily: BODY }} />
          </Reveal>
        )}

        <RevealStagger disabled={!animate} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-12 lg:gap-y-0">
          {results.map((item, i) => (
            <RevealItem key={i} disabled={!animate} className={`group flex flex-col ${isLogo ? "items-center text-center" : ""}`}>
              {isLogo ? (
                <>
                  <div className="h-16 sm:h-20 w-full flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-105" style={{ color: ink }}>
                    <InlineImage
                      src={item.logoUrl}
                      alt={item.logoAlt || item.company}
                      onUpdate={onFieldChange ? (src: string) => updateResult(i, { logoUrl: src }) : undefined}
                      onAltUpdate={onFieldChange ? (alt: string) => updateResult(i, { logoAlt: alt }) : undefined}
                      className="max-h-full max-w-[180px] w-auto h-auto object-contain"
                      wrapperClassName="inline-flex items-center justify-center max-h-full"
                    />
                  </div>
                  <InlineText
                    as="span"
                    value={item.company}
                    onUpdate={onFieldChange ? (v: string) => updateResult(i, { company: v }) : undefined}
                    className="font-extrabold text-lg tracking-tight mb-6"
                    style={{ color: ink, fontFamily: DISPLAY }} />
                </>
              ) : (
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 flex items-center justify-center shrink-0 overflow-hidden transition-transform duration-300 group-hover:scale-110" style={{ color: ink }}>
                    <InlineImage
                      src={item.logoUrl}
                      alt={item.logoAlt || item.company}
                      onUpdate={onFieldChange ? (src: string) => updateResult(i, { logoUrl: src }) : undefined}
                      onAltUpdate={onFieldChange ? (alt: string) => updateResult(i, { logoAlt: alt }) : undefined}
                      className="w-full h-full object-contain"
                      wrapperClassName="block w-full h-full"
                    />
                  </div>
                  <InlineText
                    as="span"
                    value={item.company}
                    onUpdate={onFieldChange ? (v: string) => updateResult(i, { company: v }) : undefined}
                    className="font-extrabold text-lg tracking-tight"
                    style={{ color: ink, fontFamily: DISPLAY }} />
                </div>
              )}

              {/* Accent rule that grows on hover, anchoring the metric */}
              <div
                aria-hidden
                className={`h-0.5 w-10 rounded-full mb-4 transition-all duration-300 group-hover:w-16 ${isLogo ? "mx-auto" : ""}`}
                style={{ background: `linear-gradient(90deg, ${accent}, ${accent}33)` }}
              />

              <div
                className="text-2xl sm:text-3xl font-black tracking-tight mb-4"
                style={{ color: accent, fontFamily: DISPLAY }}
              >
                {onFieldChange ? (
                  <InlineText
                    as="span"
                    value={item.metricValue}
                    onUpdate={(v: string) => updateResult(i, { metricValue: v })}
                    style={{ fontFamily: DISPLAY }} />
                ) : (
                  <StatCounter value={item.metricValue} style={{ fontFamily: DISPLAY }} />
                )}
              </div>

              <InlineText
                as="p"
                value={item.outcome}
                onUpdate={onFieldChange ? (v: string) => updateResult(i, { outcome: v }) : undefined}
                className="text-base font-medium leading-relaxed"
                style={{ color: muted, fontFamily: BODY }}
                multiline />
            </RevealItem>
          ))}
        </RevealStagger>

        {(props.ctaLabel || onFieldChange) && (
          <Reveal disabled={!animate} className="mt-16 pt-12 border-t text-center" style={{ borderColor: border }}>
            <CtaButton
              ctaAction="url"
              ctaUrl={props.ctaUrl}
              brand={brand}
              source="case-study-logo-results-row-cta"
              className="inline-flex items-center justify-center gap-2 rounded-xl px-7 py-3.5 text-base font-semibold shadow-sm transition-transform duration-200 hover:-translate-y-0.5"
              style={{ backgroundColor: accent, color: onAccent, fontFamily: BODY }}
            >
              {props.ctaLabel || "Read the case studies"}
              <ArrowRight className="h-4 w-4" />
            </CtaButton>
          </Reveal>
        )}
      </div>
    </section>
  );
}
