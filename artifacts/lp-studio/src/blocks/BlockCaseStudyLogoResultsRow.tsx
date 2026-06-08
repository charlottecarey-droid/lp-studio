import { ArrowRight } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { CaseStudyLogoResultsRowBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";

interface Props {
  props: CaseStudyLogoResultsRowBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: CaseStudyLogoResultsRowBlockProps) => void;
}

export function BlockCaseStudyLogoResultsRow({ props, brand, onFieldChange }: Props) {
  const bg = props.bgColor ?? "#ffffff";
  const ink = props.textColor ?? "#0f172a";
  const accent = props.accentColor ?? brand.primaryColor ?? "#4f46e5";
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;
  const muted = pickContrastingColor(undefined, bg, ["#64748b", "#94a3b8"]);
  const onAccent = pickContrastingColor(undefined, accent, ["#ffffff", "#0f172a"]);
  const border = `${ink}14`;

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
    <section className="w-full py-16 sm:py-24 border-y" style={{ backgroundColor: bg, borderColor: border }}>
      <div className="container mx-auto px-6 md:px-12 max-w-7xl">
        {(props.heading || onFieldChange) && (
          <InlineText
            as="h3"
            value={props.heading ?? ""}
            onUpdate={onFieldChange ? (v: string) => update("heading", v) : undefined}
            className="text-center text-sm font-bold uppercase tracking-[0.2em] mb-16"
            style={{ color: muted, fontFamily: BODY }} />
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-12 lg:gap-y-0">
          {results.map((item, i) => (
            <div key={i} className={`flex flex-col ${isLogo ? "items-center text-center" : ""}`}>
              {isLogo ? (
                <>
                  <div className="h-16 sm:h-20 w-full flex items-center justify-center mb-4" style={{ color: ink }}>
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
                  <div className="w-8 h-8 flex items-center justify-center shrink-0 overflow-hidden" style={{ color: ink }}>
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

              <InlineText
                as="div"
                value={item.metricValue}
                onUpdate={onFieldChange ? (v: string) => updateResult(i, { metricValue: v }) : undefined}
                className="text-2xl sm:text-3xl font-black tracking-tight mb-4"
                style={{ color: accent, fontFamily: DISPLAY }} />

              <InlineText
                as="p"
                value={item.outcome}
                onUpdate={onFieldChange ? (v: string) => updateResult(i, { outcome: v }) : undefined}
                className="text-base font-medium leading-relaxed"
                style={{ color: muted, fontFamily: BODY }}
                multiline />
            </div>
          ))}
        </div>

        {(props.ctaLabel || onFieldChange) && (
          <div className="mt-16 pt-12 border-t text-center" style={{ borderColor: border }}>
            <CtaButton
              ctaAction="url"
              ctaUrl={props.ctaUrl}
              brand={brand}
              source="case-study-logo-results-row-cta"
              className="inline-flex items-center justify-center gap-2 rounded-xl px-7 py-3.5 text-base font-semibold"
              style={{ backgroundColor: accent, color: onAccent, fontFamily: BODY }}
            >
              {props.ctaLabel || "Read the case studies"}
              <ArrowRight className="h-4 w-4" />
            </CtaButton>
          </div>
        )}
      </div>
    </section>
  );
}
