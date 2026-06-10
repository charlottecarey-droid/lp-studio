import { ArrowRight } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { CaseStudyCardGridBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";
import { Reveal, RevealStagger, RevealItem, AccentGlow } from "@/lib/premium-toolkit";
import { StatCounter } from "./StatCounter";

interface Props {
  props: CaseStudyCardGridBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: CaseStudyCardGridBlockProps) => void;
}

export function BlockCaseStudyCardGrid({ props, brand, onFieldChange }: Props) {
  const surface = resolveSectionSurface(props, "#f8fafc");
  const cardSurface = props.surfaceColor ?? "#ffffff";
  const ink = props.textColor ?? surface.color ?? "#0f172a";
  const accent = props.accentColor ?? brand.primaryColor ?? "#4f46e5";
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;
  const muted = pickContrastingColor(undefined, surface.base, ["#64748b", "#94a3b8"]);
  const surfaceMuted = pickContrastingColor(undefined, cardSurface, ["#64748b", "#94a3b8"]);
  const border = `${ink}14`;
  const animate = !onFieldChange;

  const cards = props.cards ?? [];
  const isLogo = props.displayMode === "logo";

  // These are customer/company *logo* slots. For AI-invented placeholder
  // companies we usually have no real logo (the image pipeline no longer
  // auto-fills a stock photo here, which used to render as a "tiny image where
  // an icon should be"). Show the logo/icon box only when a real image exists,
  // or in the builder so the editor keeps the Replace affordance; otherwise the
  // card header falls back to the company name alone.
  const hasCardImage = (c: { imageUrl?: string }) =>
    typeof c.imageUrl === "string" && c.imageUrl.trim().length > 0;
  const showCardImage = (c: { imageUrl?: string }) => hasCardImage(c) || !!onFieldChange;

  const update = <K extends keyof CaseStudyCardGridBlockProps>(
    key: K,
    value: CaseStudyCardGridBlockProps[K],
  ) => onFieldChange?.({ ...props, [key]: value });

  const updateCard = (
    i: number,
    patch: Partial<CaseStudyCardGridBlockProps["cards"][number]>,
  ) => {
    if (!onFieldChange) return;
    const next = cards.map((card, idx) => (idx === i ? { ...card, ...patch } : card));
    onFieldChange({ ...props, cards: next });
  };

  return (
    <section className="relative w-full overflow-hidden py-24 sm:py-32" style={{ background: surface.background }}>
      <AccentGlow color={accent} isDark={surface.isDark} />
      <div className="relative z-10 container mx-auto px-6 md:px-12 max-w-7xl">
        <Reveal disabled={!animate} className="text-center max-w-3xl mx-auto mb-16 md:mb-24">
          <InlineText
            as="h2"
            value={props.heading}
            onUpdate={onFieldChange ? (v: string) => update("heading", v) : undefined}
            className="text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight mb-6"
            style={{ color: ink, fontFamily: DISPLAY }} />
          {(props.subheading || onFieldChange) && (
            <InlineText
              as="p"
              value={props.subheading ?? ""}
              onUpdate={onFieldChange ? (v: string) => update("subheading", v) : undefined}
              className="text-lg md:text-xl"
              style={{ color: muted, fontFamily: BODY }}
              multiline />
          )}
        </Reveal>

        <RevealStagger disabled={!animate} className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {cards.map((card, i) => (
            <RevealItem
              key={i}
              disabled={!animate}
              className="group relative flex h-full flex-col overflow-hidden rounded-3xl border p-8 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_24px_48px_-16px_rgba(15,23,42,0.22)]"
              style={{ backgroundColor: cardSurface, borderColor: border }}
            >
              {/* Gradient accent rule along the top edge */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-1 opacity-70 transition-opacity duration-300 group-hover:opacity-100"
                style={{ background: `linear-gradient(90deg, ${accent}, ${accent}33)` }}
              />
              {/* Accent corner glow that warms on hover */}
              <div
                aria-hidden
                className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-60"
                style={{ background: `radial-gradient(circle, ${accent}, transparent 70%)` }}
              />
              <div className="relative z-10 flex h-full flex-col">
              {isLogo ? (
                <div className="flex flex-col items-center text-center gap-4 mb-8 pb-8 border-b" style={{ borderColor: border }}>
                  {showCardImage(card) && (
                  <div className="h-14 sm:h-16 w-full flex items-center justify-center" style={{ color: accent }}>
                    <InlineImage
                      src={card.imageUrl}
                      alt={card.imageAlt || card.company}
                      onUpdate={onFieldChange ? (src: string) => updateCard(i, { imageUrl: src }) : undefined}
                      onAltUpdate={onFieldChange ? (alt: string) => updateCard(i, { imageAlt: alt }) : undefined}
                      className="max-h-full max-w-[160px] w-auto h-auto object-contain"
                      wrapperClassName="inline-flex items-center justify-center max-h-full"
                    />
                  </div>
                  )}
                  <InlineText
                    as="span"
                    value={card.company}
                    onUpdate={onFieldChange ? (v: string) => updateCard(i, { company: v }) : undefined}
                    className="text-xl font-bold tracking-tight"
                    style={{ color: ink, fontFamily: DISPLAY }} />
                </div>
              ) : (
                <div className="flex items-center gap-3 mb-8 pb-8 border-b" style={{ borderColor: border }}>
                  {showCardImage(card) && (
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 overflow-hidden ring-1 transition-transform duration-300 group-hover:scale-105"
                    style={{ backgroundColor: `${accent}15`, color: accent, boxShadow: `inset 0 0 0 1px ${accent}26` }}
                  >
                    <InlineImage
                      src={card.imageUrl}
                      alt={card.imageAlt || card.company}
                      onUpdate={onFieldChange ? (src: string) => updateCard(i, { imageUrl: src }) : undefined}
                      onAltUpdate={onFieldChange ? (alt: string) => updateCard(i, { imageAlt: alt }) : undefined}
                      className="w-full h-full object-contain"
                      wrapperClassName="block w-full h-full"
                    />
                  </div>
                  )}
                  <InlineText
                    as="span"
                    value={card.company}
                    onUpdate={onFieldChange ? (v: string) => updateCard(i, { company: v }) : undefined}
                    className="text-xl font-bold tracking-tight"
                    style={{ color: ink, fontFamily: DISPLAY }} />
                </div>
              )}

              <div className="flex-grow">
                <InlineText
                  as="p"
                  value={card.result}
                  onUpdate={onFieldChange ? (v: string) => updateCard(i, { result: v }) : undefined}
                  className="text-lg font-medium leading-relaxed mb-10"
                  style={{ color: ink, fontFamily: BODY }}
                  multiline />
              </div>

              <div className="mb-10">
                <div
                  className="text-4xl font-extrabold tracking-tight mb-2"
                  style={{ color: accent, fontFamily: DISPLAY }}
                >
                  {onFieldChange ? (
                    <InlineText
                      as="span"
                      value={card.metricValue}
                      onUpdate={(v: string) => updateCard(i, { metricValue: v })}
                      style={{ fontFamily: DISPLAY }} />
                  ) : (
                    <StatCounter value={card.metricValue} style={{ fontFamily: DISPLAY }} />
                  )}
                </div>
                <InlineText
                  as="div"
                  value={card.metricLabel}
                  onUpdate={onFieldChange ? (v: string) => updateCard(i, { metricLabel: v }) : undefined}
                  className="text-sm font-semibold uppercase tracking-wider"
                  style={{ color: surfaceMuted, fontFamily: BODY }} />
              </div>

              <CtaButton
                ctaAction="url"
                ctaUrl={card.linkUrl}
                brand={brand}
                source="case-study-card-grid-story"
                className="inline-flex items-center gap-2 font-bold group-hover:gap-3 transition-all self-start"
                style={{ color: accent, fontFamily: BODY }}
              >
                View story <ArrowRight className="w-4 h-4" />
              </CtaButton>
              </div>
            </RevealItem>
          ))}
        </RevealStagger>

        {(props.ctaLabel || onFieldChange) && (
          <Reveal disabled={!animate} className="flex justify-center">
            <CtaButton
              ctaAction="url"
              ctaUrl={props.ctaUrl}
              brand={brand}
              source="case-study-card-grid-cta"
              className="inline-flex items-center justify-center gap-2 font-bold"
              style={{ color: accent, fontFamily: BODY }}
            >
              {props.ctaLabel || "Explore all customer stories"}
              <ArrowRight className="w-4 h-4" />
            </CtaButton>
          </Reveal>
        )}
      </div>
    </section>
  );
}
