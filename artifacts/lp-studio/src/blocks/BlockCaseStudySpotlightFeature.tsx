import { ArrowRight, BarChart3, Zap } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { CaseStudySpotlightFeatureBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";

interface Props {
  props: CaseStudySpotlightFeatureBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: CaseStudySpotlightFeatureBlockProps) => void;
}

export function BlockCaseStudySpotlightFeature({ props, brand, onFieldChange }: Props) {
  const bg = props.bgColor ?? "#ffffff";
  const surface = props.surfaceColor ?? "#ffffff";
  const ink = props.textColor ?? "#0f172a";
  const accent = props.accentColor ?? brand.primaryColor ?? "#4f46e5";
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;
  const muted = pickContrastingColor(undefined, bg, ["#64748b", "#94a3b8"]);
  const surfaceMuted = pickContrastingColor(undefined, surface, ["#64748b", "#94a3b8"]);
  const border = `${ink}14`;

  const update = <K extends keyof CaseStudySpotlightFeatureBlockProps>(
    key: K,
    value: CaseStudySpotlightFeatureBlockProps[K],
  ) => onFieldChange?.({ ...props, [key]: value });

  return (
    <section className="w-full py-24 sm:py-32" style={{ backgroundColor: bg }}>
      <div className="container mx-auto px-6 md:px-12 max-w-7xl">
        {(props.eyebrow || onFieldChange) && (
          <div className="mb-12">
            <InlineText
              as="span"
              value={props.eyebrow ?? ""}
              onUpdate={onFieldChange ? (v: string) => update("eyebrow", v) : undefined}
              className="text-sm font-bold uppercase tracking-wider block"
              style={{ color: accent, fontFamily: BODY }} />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Content Side */}
          <div className="flex flex-col">
            <div className="flex items-center gap-3 mb-8">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${accent}1a`, color: accent }}
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

            <div className="space-y-6 mb-10 text-lg leading-relaxed">
              <div>
                <span className="block mb-1 font-semibold uppercase tracking-wider text-xs" style={{ color: ink, fontFamily: BODY }}>The Challenge</span>
                <InlineText
                  as="p"
                  value={props.challenge}
                  onUpdate={onFieldChange ? (v: string) => update("challenge", v) : undefined}
                  style={{ color: muted, fontFamily: BODY }}
                  multiline />
              </div>
              <div>
                <span className="block mb-1 font-semibold uppercase tracking-wider text-xs" style={{ color: ink, fontFamily: BODY }}>The Solution</span>
                <InlineText
                  as="p"
                  value={props.solution}
                  onUpdate={onFieldChange ? (v: string) => update("solution", v) : undefined}
                  style={{ color: muted, fontFamily: BODY }}
                  multiline />
              </div>
              <div>
                <span className="block mb-1 font-semibold uppercase tracking-wider text-xs" style={{ color: ink, fontFamily: BODY }}>The Result</span>
                <InlineText
                  as="p"
                  value={props.result}
                  onUpdate={onFieldChange ? (v: string) => update("result", v) : undefined}
                  style={{ color: muted, fontFamily: BODY }}
                  multiline />
              </div>
            </div>

            <div
              className="p-6 rounded-2xl mb-10 border"
              style={{ backgroundColor: surface, borderColor: border }}
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${accent}1a`, color: accent }}
                >
                  <BarChart3 className="w-6 h-6" />
                </div>
                <div>
                  <InlineText
                    as="div"
                    value={props.metricValue}
                    onUpdate={onFieldChange ? (v: string) => update("metricValue", v) : undefined}
                    className="text-3xl font-bold tracking-tight mb-1"
                    style={{ color: ink, fontFamily: DISPLAY }} />
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
          </div>

          {/* Image Side */}
          <div className="relative">
            <div
              className="absolute -inset-4 rounded-3xl opacity-50 blur-2xl transform rotate-3"
              style={{ backgroundColor: accent }}
            />
            <div
              className="relative aspect-[4/3] rounded-2xl overflow-hidden border shadow-xl"
              style={{ borderColor: border, backgroundColor: surface }}
            >
              <InlineImage
                src={props.imageUrl}
                alt={props.imageAlt || `${props.company} feature photo`}
                onUpdate={onFieldChange ? (src: string) => update("imageUrl", src) : undefined}
                onAltUpdate={onFieldChange ? (alt: string) => update("imageAlt", alt) : undefined}
                className="w-full h-full object-cover"
                wrapperClassName="block w-full h-full"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
